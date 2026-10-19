import { api, ApiError } from '@/lib/api'
import { db, installFakeBackend, json } from '@/test/fake-backend'

beforeEach(() => installFakeBackend())
afterEach(() => vi.unstubAllGlobals())

const failure = async (path: string): Promise<ApiError> => {
  const error = await api('/x' + path).catch((e: unknown) => e)
  if (!(error instanceof ApiError)) throw new Error('expected an ApiError')
  return error
}

it('uses the backend code and message when the body has them', async () => {
  db.overrides['/x/coded'] = () => json(409, { code: 'conflict', message: 'Already decided' })
  const error = await failure('/coded')
  expect([error.code, error.message, error.status]).toEqual(['conflict', 'Already decided', 409])
})

it('turns a FastAPI validation list into its first message, without the "Value error, " prefix', async () => {
  db.overrides['/x/invalid'] = () =>
    json(422, { detail: [{ loc: ['body', 'phone'], msg: 'Value error, phone must be E.164 format', type: 'value_error' }] })
  const error = await failure('/invalid')
  expect([error.code, error.message]).toEqual(['validation_error', 'phone must be E.164 format'])
})

it('uses a plain string detail as the message', async () => {
  db.overrides['/x/plain'] = () => json(404, { detail: 'Not Found' })
  const error = await failure('/plain')
  expect([error.message, error.status]).toEqual(['Not Found', 404])
})

it('does not trip over a non-list, non-string detail', async () => {
  db.overrides['/x/odd'] = () => json(422, { detail: { msg: 'weird' } })
  const error = await failure('/odd')
  expect([error.code, error.message]).toEqual(['validation_error', 'Invalid request'])
})

it('falls back to a generic message for an empty 5xx', async () => {
  db.overrides['/x/down'] = () => json(503)
  const error = await failure('/down')
  expect([error.code, error.status]).toEqual(['server_error', 503])
})
