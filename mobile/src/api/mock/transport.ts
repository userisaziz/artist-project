import type { Transport, TransportRequest, TransportResponse } from '../transport';
import type { TokenPair, User, UserRole } from '../types';
import { CATALOG, CITIES, MockArtists } from './artist';

interface MockOtp { phone: string; code: string; createdAt: number; expiresAt: number; attempts: number; consumed: boolean }
interface MockRefresh { token: string; userId: string; expiresAt: number; revoked: boolean }

const PHONE_RE = /^\+[1-9]\d{6,14}$/;            // same as backend schemas/auth.py
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_ORDER: UserRole[] = ['customer', 'artist', 'admin']; // backend UserOut sorts roles in this order
const ACCOUNT_ROUTES = new Set(['PATCH /users/me', 'PUT /users/me/role']); // all need a Bearer token
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

  /** Storage key → local file URI. The uploader registers picked images here so mock image URLs render them. */
  readonly files = new Map<string, string>();
  private artists = new MockArtists(this.files);

  private offset = 0; // test-only skew added to the wall clock
  private get now() { return Date.now() + this.offset; }
  private otps: MockOtp[] = [];
  private refreshes: MockRefresh[] = [];
  private users = new Map<string, User>();
  private accessTokens = new Map<string, string>(); // access token → user id
  private seq = 0;

  advanceTime(ms: number) { this.offset += ms; }

  /** Admin approve/reject stand-in, keyed by phone like the rest of the mock's test hooks. */
  review(phone: string, decision: 'approved' | 'rejected', reason?: string) {
    const user = this.users.get(phone);
    if (!user) throw new Error(`No mock user ${phone}`);
    this.artists.review(user.id, decision, reason ?? null);
  }

  private fakeToken(kind: string) { return `mock-${kind}-${++this.seq}-${Math.random().toString(36).slice(2)}`; }

  async request({ method, path, body, headers }: TransportRequest): Promise<TransportResponse> {
    const data = (body ?? {}) as Record<string, string>;
    if (path === '/auth/otp/request') return this.otpRequest(data.phone ?? '');
    if (path === '/auth/otp/verify') return this.otpVerify(data.phone ?? '', data.code ?? '');
    if (path === '/auth/refresh') return this.refresh(data.refresh_token ?? '');
    if (method === 'GET' && path === '/categories') return ok(CATALOG);
    if (method === 'GET' && path === '/cities') return ok(CITIES);
    if (path === '/uploads/signature' || path.startsWith('/artists/me')) {
      const user = this.userFor(headers);
      if (!user) return err('auth_error', 'Authentication failed', 401);
      if (!user.roles.includes('artist')) return err('forbidden', 'Not allowed for this account', 403); // backend require_role: held roles, not the active side
      if (path === '/uploads/signature') return this.artists.uploadTicket(user.id, data.purpose);
      return this.artists.handle(user.id, method, path, (body ?? {}) as Record<string, unknown>);
    }
    if (ACCOUNT_ROUTES.has(`${method} ${path}`)) {
      const user = this.userFor(headers);
      if (!user) return err('auth_error', 'Authentication failed', 401);
      if (path === '/users/me') return this.updateMe(user, (body ?? {}) as Record<string, unknown>);
      return this.chooseRole(user, data.role);
    }
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
        roles: isArtistSeed ? ['artist'] : [],
        active_role: isArtistSeed ? 'artist' : null,
        first_name: isArtistSeed ? 'Priya' : null,
        last_name: null, email: null, whatsapp_booking_updates: true,
        is_onboarded: isArtistSeed,
      };
      this.users.set(phone, user);
      if (isArtistSeed) this.artists.seedApproved(user.id);
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

  private userFor(headers?: Record<string, string>): User | undefined {
    const id = this.accessTokens.get((headers?.Authorization ?? '').replace(/^Bearer /, ''));
    return [...this.users.values()].find((u) => u.id === id);
  }

  private save(user: User): User {
    this.users.set(user.phone, user);
    return user;
  }

  private updateMe(user: User, b: Record<string, unknown>): TransportResponse {
    const email = typeof b.email === 'string' && b.email.trim() ? b.email.trim() : null;
    if (typeof b.first_name !== 'string' || !b.first_name.trim()) return err('validation_error', 'first_name is required', 422);
    if (email && !EMAIL_RE.test(email)) return err('validation_error', 'email is not a valid address', 422);
    const taken = email && [...this.users.values()].some((u) => u.id !== user.id && u.email?.toLowerCase() === email.toLowerCase());
    if (taken) return err('conflict', 'That email is already in use', 409);
    return ok(this.save({
      ...user,
      first_name: b.first_name.trim(),
      last_name: typeof b.last_name === 'string' && b.last_name.trim() ? b.last_name.trim() : null,
      email,
      whatsapp_booking_updates: b.whatsapp_booking_updates !== false,
    }));
  }

  /** Same rules as backend UserService.choose_role: grant the role if new, then show that side (also "switch side"). */
  private chooseRole(user: User, role: string | undefined): TransportResponse {
    if (role !== 'customer' && role !== 'artist') return err('validation_error', 'role must be customer or artist', 422);
    const roles = ROLE_ORDER.filter((r) => r === role || user.roles.includes(r));
    return ok(this.save({ ...user, roles, active_role: role, is_onboarded: true }));
  }

  private issuePair(user: User): TokenPair {
    const refreshToken = this.fakeToken('refresh');
    this.refreshes.push({ token: refreshToken, userId: user.id, expiresAt: this.now + REFRESH_TTL_MS, revoked: false });
    const accessToken = this.fakeToken('access');
    this.accessTokens.set(accessToken, user.id);
    return { access_token: accessToken, refresh_token: refreshToken, token_type: 'bearer', user };
  }
}
