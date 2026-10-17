import { request } from '../../core/api/client';
import type { TokenPair } from '../../types/auth/auth';

// Mirrors the backend contract table (spec §3) — keep paths/statuses in lockstep with backend plan Tasks 3–4.
export function requestOtp(phone: string) {
  return request<void>('/auth/otp/request', { phone });
}
export function verifyOtp(phone: string, code: string) {
  return request<TokenPair>('/auth/otp/verify', { phone, code });
}
export function refreshSession(refreshToken: string) {
  return request<TokenPair>('/auth/refresh', { refresh_token: refreshToken });
}
