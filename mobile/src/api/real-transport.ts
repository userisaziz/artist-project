import type { Transport, TransportRequest, TransportResponse } from './transport';
import { ApiError } from './types';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export class RealTransport implements Transport {
  async request({ method, path, body, headers }: TransportRequest): Promise<TransportResponse> {
    try {
      const res = await fetch(`${BASE_URL}/api/v1${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = res.status === 204 ? null : await res.json().catch(() => null);
      return { status: res.status, json };
    } catch {
      // Network errors become typed ApiErrors so screens can show the retry banner — never a silent reject.
      throw new ApiError('network_error', 'Network unreachable. Check your connection.', 0);
    }
  }
}
