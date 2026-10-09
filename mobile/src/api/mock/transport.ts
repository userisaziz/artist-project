import type { Transport, TransportRequest, TransportResponse } from '../transport';
import type { TokenPair, User } from '../types';

interface MockOtp { phone: string; code: string; createdAt: number; expiresAt: number; attempts: number; consumed: boolean }
interface MockRefresh { token: string; userId: string; expiresAt: number; revoked: boolean }

const PHONE_RE = /^\+[1-9]\d{6,14}$/;            // same as backend schemas/auth.py
const RESEND_COOLDOWN_MS = 60_000;               // OTP_RESEND_COOLDOWN_SECONDS
const OTP_TTL_MS = 5 * 60_000;                   // OTP_TTL_MINUTES
const MAX_ATTEMPTS = 5;                          // OTP_MAX_ATTEMPTS
const REFRESH_TTL_MS = 7 * 24 * 3600_000;        // REFRESH_TOKEN_TTL_DAYS

const err = (code: string, message: string, status: number): TransportResponse => ({ status, json: { code, message } });
const ok = (json: unknown): TransportResponse => ({ status: 200, json });
const noContent: TransportResponse = { status: 204, json: null };

export class MockTransport implements Transport {
  onOtpGenerated?: (phone: string, code: string) => void;
  /** Most recent generated code, so the OTP screen can replay it in dev. */
  lastOtp?: { phone: string; code: string };

  private offset = 0; // test-only skew added to the wall clock
  private get now() { return Date.now() + this.offset; }
  private otps: MockOtp[] = [];
  private refreshes: MockRefresh[] = [];
  private users = new Map<string, User>();
  private seq = 0;

  advanceTime(ms: number) { this.offset += ms; }

  private fakeToken(kind: string) { return `mock-${kind}-${++this.seq}-${Math.random().toString(36).slice(2)}`; }

  async request({ path, body }: TransportRequest): Promise<TransportResponse> {
    const data = (body ?? {}) as Record<string, string>;
    if (path === '/auth/otp/request') return this.otpRequest(data.phone ?? '');
    if (path === '/auth/otp/verify') return this.otpVerify(data.phone ?? '', data.code ?? '');
    if (path === '/auth/refresh') return this.refresh(data.refresh_token ?? '');
    return err('not_found', `Mock has no handler for ${path}`, 404); // loud: contract drift surfaces, never silent
  }

  private otpRequest(phone: string): TransportResponse {
    if (!PHONE_RE.test(phone)) return err('validation_error', 'phone must be E.164 format, e.g. +15550001111', 422);
    const latest = [...this.otps].reverse().find((o) => o.phone === phone);
    if (latest && this.now - latest.createdAt < RESEND_COOLDOWN_MS) {
      return err('rate_limited', 'Please wait before requesting another code', 429);
    }
    for (const o of this.otps) if (o.phone === phone && !o.consumed) o.consumed = true;
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    if (__DEV__) console.log('mock://otp', phone, code);
    this.otps.push({ phone, code, createdAt: this.now, expiresAt: this.now + OTP_TTL_MS, attempts: 0, consumed: false });
    this.lastOtp = { phone, code };
    this.onOtpGenerated?.(phone, code);
    return noContent;
  }

  private otpVerify(phone: string, code: string): TransportResponse {
    const otp = [...this.otps].reverse().find((o) => o.phone === phone && !o.consumed && o.expiresAt > this.now);
    if (!otp || otp.attempts >= MAX_ATTEMPTS) return err('auth_error', 'Invalid or expired code', 401);
    if (otp.code !== code) { otp.attempts += 1; return err('auth_error', 'Invalid or expired code', 401); }
    otp.consumed = true;
    let user = this.users.get(phone);
    if (!user) {  // JIT registration, same as backend verify_otp
      const isArtistSeed = phone === '+15550009999';
      user = {
        id: this.fakeToken('user'), phone, is_phone_verified: true,
        role: isArtistSeed ? 'artist' : 'customer',
        first_name: isArtistSeed ? 'Priya' : null,
      };
      this.users.set(phone, user);
    }
    return ok(this.issuePair(user));
  }

  private refresh(token: string): TransportResponse {
    const row = this.refreshes.find((r) => r.token === token);
    if (!row || row.revoked || row.expiresAt < this.now) return err('auth_error', 'Refresh token expired or revoked', 401);
    row.revoked = true; // rotation
    const user = [...this.users.values()].find((u) => u.id === row.userId);
    if (!user) return err('auth_error', 'Refresh token expired or revoked', 401);
    return ok(this.issuePair(user));
  }

  private issuePair(user: User): TokenPair {
    const refreshToken = this.fakeToken('refresh');
    this.refreshes.push({ token: refreshToken, userId: user.id, expiresAt: this.now + REFRESH_TTL_MS, revoked: false });
    return { access_token: this.fakeToken('access'), refresh_token: refreshToken, token_type: 'bearer', user };
  }
}
