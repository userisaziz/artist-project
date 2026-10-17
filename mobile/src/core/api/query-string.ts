/** Builds `path?a=1&b=2`, skipping empty values. Hand-rolled: React Native's URLSearchParams is incomplete. */
export function withQuery(path: string, params: Record<string, string | number | null | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `${path}?${parts.join('&')}` : path;
}

/** Splits `path?query` into the path and its decoded parameters (the mock's side of withQuery). */
export function parseQuery(full: string): { path: string; query: Record<string, string> } {
  const [path, qs = ''] = full.split('?');
  const query: Record<string, string> = {};
  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    query[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return { path, query };
}
