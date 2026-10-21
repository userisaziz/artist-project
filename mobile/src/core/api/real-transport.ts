import Constants from 'expo-constants';
import type { Transport, TransportRequest, TransportResponse } from './transport';
import { ApiError } from './types';

const DEV_API_URL = 'http://localhost:8000';
const DEV_API_PORT = 8000;

/** In development the API runs next to Metro: a phone reaches it on the address it loaded the bundle from
 *  (the Mac's current LAN IP), the browser on localhost. So a new Wi-Fi network never needs an .env edit. */
function devApiUrl(): string {
  const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return metroHost ? `http://${metroHost}:${DEV_API_PORT}` : DEV_API_URL;
}

/** Release builds must be pointed at a real API: falling back to localhost would ship an app that can never connect. */
function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL; // read literally so Expo can inline it at build time
  if (configured) return configured.replace(/\/$/, '');
  if (__DEV__) return devApiUrl();
  throw new Error('EXPO_PUBLIC_API_URL is not set: release builds need the API base URL (see mobile/.env.example).');
}

export const BASE_URL = resolveBaseUrl();
export const REQUEST_TIMEOUT_MS = 15_000; // a hung request becomes a network_error instead of an endless spinner

export class RealTransport implements Transport {
  async request({ method, path, body, headers }: TransportRequest): Promise<TransportResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api/v1${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      // Network errors and timeouts become typed ApiErrors so screens can show the retry banner — never a silent reject.
      throw new ApiError('network_error', 'Network unreachable. Check your connection.', 0);
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 204) return { status: 204, json: null };
    const ok = res.status >= 200 && res.status < 300;
    const json = await res.json().catch(() => {
      // 2xx with a broken body is a server bug, not success; non-2xx stays null and the client maps it to server_error.
      if (ok) throw new ApiError('server_error', 'Something went wrong. Please try again.', res.status);
      return null;
    });
    return { status: res.status, json };
  }
}
