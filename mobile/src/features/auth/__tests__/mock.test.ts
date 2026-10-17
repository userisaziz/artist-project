import { MockTransport } from '../../../core/api/mock/transport';

const PHONE = '+15550001111';

let logSpy: jest.SpyInstance;
beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  logSpy.mockRestore();
});

async function requestOtp(t: MockTransport, phone = PHONE) {
  return t.request({ method: 'POST', path: '/auth/otp/request', body: { phone } });
}

it('request returns 204 and emits the code via callback', async () => {
  const t = new MockTransport();
  const seen: string[] = [];
  t.onOtpGenerated = (_phone, code) => seen.push(code);
  const res = await requestOtp(t);
  expect(res.status).toBe(204);
  expect(seen).toHaveLength(1);
  expect(seen[0]).toMatch(/^\d{6}$/);
});

it('records the most recent code in lastOtp after a successful request', async () => {
  const t = new MockTransport();
  expect(t.lastOtp).toBeUndefined();
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await requestOtp(t);
  expect(t.lastOtp).toEqual({ phone: PHONE, code });
});

it('resend within 60s is rate limited (429 rate_limited)', async () => {
  const t = new MockTransport();
  await requestOtp(t);
  const res = await requestOtp(t);
  expect(res.status).toBe(429);
  expect((res.json as { code: string }).code).toBe('rate_limited');
});

it('follows the wall clock: cooldown elapses with real time, no advanceTime', async () => {
  const t0 = 1_700_000_000_000;
  const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(t0);
  try {
    const t = new MockTransport();
    expect((await requestOtp(t)).status).toBe(204);
    nowSpy.mockReturnValue(t0 + 60_001);
    expect((await requestOtp(t)).status).toBe(204);
  } finally {
    nowSpy.mockRestore();
  }
});

it('rejects non E.164 phone with 422', async () => {
  const t = new MockTransport();
  const res = await requestOtp(t, '15550001111');
  expect(res.status).toBe(422);
});

it('verify with correct code creates JIT user and returns TokenPair', async () => {
  const t = new MockTransport();
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await requestOtp(t);
  const res = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone: PHONE, code } });
  expect(res.status).toBe(200);
  const pair = res.json as { access_token: string; refresh_token: string; user: { phone: string; is_phone_verified: boolean } };
  expect(pair.access_token).toBeTruthy();
  expect(pair.user.phone).toBe(PHONE);
  expect(pair.user.is_phone_verified).toBe(true);
});

it('wrong code increments attempts; 6th try fails even with correct code (max 5)', async () => {
  const t = new MockTransport();
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await requestOtp(t);
  for (let i = 0; i < 5; i++) {
    const bad = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone: PHONE, code: '000000' === code ? '111111' : '000000' } });
    expect(bad.status).toBe(401);
  }
  const good = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone: PHONE, code } });
  expect(good.status).toBe(401);
});

it('expired code (5 min) is rejected', async () => {
  const t = new MockTransport();
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await requestOtp(t);
  t.advanceTime(5 * 60 * 1000 + 1);
  const res = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone: PHONE, code } });
  expect(res.status).toBe(401);
});

it('refresh rotates: old token is dead after one use', async () => {
  const t = new MockTransport();
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await requestOtp(t);
  const verify = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone: PHONE, code } });
  const pair = verify.json as { refresh_token: string };
  const fresh = await t.request({ method: 'POST', path: '/auth/refresh', body: { refresh_token: pair.refresh_token } });
  expect(fresh.status).toBe(200);
  const reuse = await t.request({ method: 'POST', path: '/auth/refresh', body: { refresh_token: pair.refresh_token } });
  expect(reuse.status).toBe(401);
});

it('known artist phone returns an artist (lets UI test role rendering without backend)', async () => {
  const t = new MockTransport();
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await requestOtp(t, '+15550009999');
  const res = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone: '+15550009999', code } });
  expect((res.json as { user: unknown }).user).toMatchObject({ roles: ['artist'], active_role: 'artist' });
});

// ---- Account + role endpoints (same contract as backend /users/me) ----

async function signIn(t: MockTransport, phone = PHONE) {
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await requestOtp(t, phone);
  const res = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone, code } });
  const pair = res.json as { access_token: string; user: Record<string, unknown> };
  return { auth: { Authorization: `Bearer ${pair.access_token}` }, user: pair.user };
}

it('a new user starts with no name and is not onboarded', async () => {
  const { user } = await signIn(new MockTransport());
  expect(user.first_name).toBeNull();
  expect(user.is_onboarded).toBe(false);
  expect(user).toMatchObject({ roles: [], active_role: null }); // same as backend JIT registration
  expect(user.whatsapp_booking_updates).toBe(true);
});

it('PATCH /users/me saves the sign-up details', async () => {
  const t = new MockTransport();
  const { auth } = await signIn(t);
  const res = await t.request({ method: 'PATCH', path: '/users/me', headers: auth, body: { first_name: 'Ananya', last_name: 'Rao', email: 'ananya@example.com', whatsapp_booking_updates: false } });
  expect(res.status).toBe(200);
  expect(res.json).toMatchObject({ first_name: 'Ananya', last_name: 'Rao', email: 'ananya@example.com', whatsapp_booking_updates: false });
});

it('PATCH /users/me rejects an email another account uses (409) and a malformed one (422)', async () => {
  const t = new MockTransport();
  const a = await signIn(t, '+15550001111');
  await t.request({ method: 'PATCH', path: '/users/me', headers: a.auth, body: { first_name: 'A', last_name: null, email: 'taken@example.com', whatsapp_booking_updates: true } });
  const b = await signIn(t, '+15550002222');
  const dup = await t.request({ method: 'PATCH', path: '/users/me', headers: b.auth, body: { first_name: 'B', last_name: null, email: 'Taken@example.com', whatsapp_booking_updates: true } });
  expect(dup).toMatchObject({ status: 409, json: { code: 'conflict' } });
  const bad = await t.request({ method: 'PATCH', path: '/users/me', headers: b.auth, body: { first_name: 'B', last_name: null, email: 'not-an-email', whatsapp_booking_updates: true } });
  expect(bad).toMatchObject({ status: 422, json: { code: 'validation_error' } });
});

it('PUT /users/me/role grants the role, makes it active and onboards the user', async () => {
  const t = new MockTransport();
  const { auth } = await signIn(t);
  const artist = await t.request({ method: 'PUT', path: '/users/me/role', headers: auth, body: { role: 'artist' } });
  expect(artist).toMatchObject({ status: 200, json: { roles: ['artist'], active_role: 'artist', is_onboarded: true } });
});

it('PUT /users/me/role again switches sides and keeps every granted role', async () => {
  const t = new MockTransport();
  const { auth } = await signIn(t);
  await t.request({ method: 'PUT', path: '/users/me/role', headers: auth, body: { role: 'artist' } });
  const switched = await t.request({ method: 'PUT', path: '/users/me/role', headers: auth, body: { role: 'customer' } });
  expect(switched).toMatchObject({ status: 200, json: { roles: ['customer', 'artist'], active_role: 'customer' } });
});

it('PUT /users/me/role rejects admin (422)', async () => {
  const t = new MockTransport();
  const { auth } = await signIn(t);
  const res = await t.request({ method: 'PUT', path: '/users/me/role', headers: auth, body: { role: 'admin' } });
  expect(res).toMatchObject({ status: 422, json: { code: 'validation_error' } });
});

it('account endpoints require a valid access token (401)', async () => {
  const t = new MockTransport();
  const res = await t.request({ method: 'PATCH', path: '/users/me', headers: { Authorization: 'Bearer nope' }, body: { first_name: 'X' } });
  expect(res).toMatchObject({ status: 401, json: { code: 'auth_error' } });
});

it('the seeded artist arrives already onboarded', async () => {
  const { user } = await signIn(new MockTransport(), '+15550009999');
  expect(user).toMatchObject({ first_name: 'Priya', roles: ['artist'], active_role: 'artist', is_onboarded: true });
});
