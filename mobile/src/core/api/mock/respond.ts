import type { TransportResponse } from '../transport';

// Response helpers every mock handler shares; the error body matches the backend's `{code, message}` envelope.

export type Body = Record<string, unknown>;
export type Query = Record<string, string>;

export const err = (code: string, message: string, status: number, extra: object = {}): TransportResponse => ({ status, json: { code, message, ...extra } });
export const ok = (json: unknown, status = 200): TransportResponse => ({ status, json });
export const noContent: TransportResponse = { status: 204, json: null };
