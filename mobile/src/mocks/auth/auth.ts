import type { TransportResponse } from '../../core/api/transport';
import { err, noContent, ok } from '../respond';
import type { TokenPair, User } from '../../types/auth/auth';

// OTP sign-in and token rotation, same rules as backend services/auth_service.py — keep them in lockstep.

interface MockOtp { phone: string; code: string; createdAt: number; expiresAt: number; attempts: number; consumed: boolean }
interface MockRefresh { token: string; userId: string; expiresAt: number; revoked: boolean }

const PHONE_RE = /^\+[1-9]\d{6,14}$/;            // same as backend schemas/auth.py
const RESEND_COOLDOWN_MS = 60_000;               // OTP_RESEND_COOLDOWN_SECONDS
const OTP_TTL_MS = 5 * 60_000;                   // OTP_TTL_MINUTES
const MAX_ATTEMPTS = 5;                          // OTP_MAX_ATTEMPTS
const REFRESH_TTL_MS = 7 * 24 * 3600_000;        // REFRESH_TOKEN_TTL_DAYS

export interface AuthDeps {
  /** Every account, keyed by phone (shared with the rest of the mock). */
  users: Map<string, User>;
  newToken: (kind: string) => string;
  now: () => number;
  /** Called with every generated code (MockTransport records it for the OTP screen and tests). */
  onOtp: (phone: string, code: string) => void;
}

/** In-memory OTPs, refresh tokens and access tokens for MockTransport. */
export class MockAuth {
  private otps: MockOtp[] = [];
  private refreshes: MockRefresh[] = [];
  private accessTokens = new Map<string, string>(); // access token → user id
  constructor(private deps: AuthDeps) {}

  private get now() { return this.deps.now(); }

  /** POST /auth/otp/request, /auth/otp/verify and /auth/refresh; null for any other path. */
  handle(path: string, data: Record<string, string>): TransportResponse | null {
    if (path === '/auth/otp/request') return this.otpRequest(data.phone ?? '');
    if (path === '/auth/otp/verify') return this.otpVerify(data.phone ?? '', data.code ?? '');
    if (path === '/auth/refresh') return this.refresh(data.refresh_token ?? '');
    return null;
  }

  /** The signed-in user behind a Bearer header, if any. */
  userFor(headers?: Record<string, string>): User | undefined {
    const id = this.accessTokens.get((headers?.Authorization ?? '').replace(/^Bearer /, ''));
    return [...this.deps.users.values()].find((u) => u.id === id);
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
    this.deps.onOtp(phone, code);
    return noContent;
  }

  private otpVerify(phone: string, code: string): TransportResponse {
    const otp = [...this.otps].reverse().find((o) => o.phone === phone && !o.consumed && o.expiresAt > this.now);
    if (!otp || otp.attempts >= MAX_ATTEMPTS) return err('auth_error', 'Invalid or expired code', 401);
    if (otp.code !== code) { otp.attempts += 1; return err('auth_error', 'Invalid or expired code', 401); }
    otp.consumed = true;
    let user = this.deps.users.get(phone);
    if (!user) {  // JIT registration, same as backend verify_otp (seeded artists and customers already exist)
      user = {
        id: this.deps.newToken('user'), phone, is_phone_verified: true, roles: [], active_role: null,
        first_name: null, last_name: null, email: null, whatsapp_booking_updates: true, is_onboarded: false,
      };
      this.deps.users.set(phone, user);
    }
    return ok(this.issuePair(user));
  }

  private refresh(token: string): TransportResponse {
    const row = this.refreshes.find((r) => r.token === token);
    if (!row || row.revoked || row.expiresAt < this.now) return err('auth_error', 'Refresh token expired or revoked', 401);
    row.revoked = true; // rotation
    const user = [...this.deps.users.values()].find((u) => u.id === row.userId);
    if (!user) return err('auth_error', 'Refresh token expired or revoked', 401);
    return ok(this.issuePair(user));
  }

  private issuePair(user: User): TokenPair {
    const refreshToken = this.deps.newToken('refresh');
    this.refreshes.push({ token: refreshToken, userId: user.id, expiresAt: this.now + REFRESH_TTL_MS, revoked: false });
    const accessToken = this.deps.newToken('access');
    this.accessTokens.set(accessToken, user.id);
    return { access_token: accessToken, refresh_token: refreshToken, token_type: 'bearer', user };
  }
}
