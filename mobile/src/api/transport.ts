export interface TransportRequest {
  method: 'POST';
  path: string;          // API-relative, e.g. '/auth/otp/verify'
  body?: unknown;
  headers?: Record<string, string>;
}

export interface TransportResponse {
  status: number;
  json: unknown | null;  // null for 204
}

export interface Transport {
  request(req: TransportRequest): Promise<TransportResponse>;
}
