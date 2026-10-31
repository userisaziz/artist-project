import { Platform } from 'react-native';
import { ImageManipulator } from 'expo-image-manipulator';
import { postToStorage, uploadImage } from '../../api/artist-onboarding/upload';
import * as artistApi from '../../api/artist-onboarding/artist-onboarding';
import { ApiError } from '../../core/api/types';
import type { UploadTicket } from '../../types/artist-onboarding/artist-onboarding';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: jest.fn() } }));
jest.mock('../../api/artist-onboarding/artist-onboarding', () => ({ uploadTicket: jest.fn() }));

// Shape of backend POST /uploads/signature (app/upload/schemas.py).
const ticket: UploadTicket = { upload_url: 'https://storage.example.com/bucket', method: 'POST', fields: { key: 'artists/a/photo.jpg', policy: 'p' }, headers: {}, key: 'artists/a/photo.jpg' };
// R2: a presigned PUT; the signature pins Content-Type, so the headers must be sent as given.
const putTicket: UploadTicket = { upload_url: 'https://acct.r2.cloudflarestorage.com/pics/artists/a/x?X-Amz-Signature=s', method: 'PUT', fields: {}, headers: { 'Content-Type': 'image/jpeg' }, key: 'artists/a/x' };
const image = { uri: 'file:///photo.jpg', width: 4000, height: 3000 };

const realFetch = global.fetch;
const realFormData = global.FormData;
/** React Native's FormData accepts a {uri, name, type} file part; Node's (jest) does not, so record parts instead. */
class RecordingFormData {
  parts: unknown[][] = [];
  append(...args: unknown[]): void { this.parts.push(args); }
}
const fetchMock = jest.fn();
const os = Platform.OS;

function manipulatorSaves(result: Promise<{ uri: string; width: number; height: number }>): void {
  jest.mocked(ImageManipulator.manipulate).mockReturnValue({
    resize: jest.fn(),
    renderAsync: async () => ({ saveAsync: () => result }),
  } as unknown as ReturnType<typeof ImageManipulator.manipulate>);
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  global.FormData = RecordingFormData as unknown as typeof FormData;
});
afterEach(() => {
  global.fetch = realFetch;
  global.FormData = realFormData;
  Platform.OS = os;
});

describe('postToStorage', () => {
  it('maps a fetch TypeError to network_error and keeps the cause', async () => {
    const cause = new TypeError('Network request failed');
    fetchMock.mockRejectedValue(cause);
    const p = postToStorage(ticket, 'file:///small.jpg');
    await expect(p).rejects.toBeInstanceOf(ApiError);
    await expect(p).rejects.toMatchObject({ code: 'network_error', status: 0, cause });
  });

  it('maps an aborted (timed out) upload to network_error', async () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    fetchMock.mockRejectedValue(abort);
    await expect(postToStorage(ticket, 'file:///small.jpg')).rejects.toMatchObject({ code: 'network_error' });
  });

  it('maps a storage rejection to upload_failed', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    await expect(postToStorage(ticket, 'file:///small.jpg')).rejects.toMatchObject({ code: 'upload_failed', status: 403 });
  });

  it('does not disguise an unexpected bug as a network error', async () => {
    fetchMock.mockRejectedValue(new RangeError('bug'));
    await expect(postToStorage(ticket, 'file:///small.jpg')).rejects.toBeInstanceOf(RangeError);
  });

  it('POSTs the signed fields and the file part as a form', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    await postToStorage(ticket, 'file:///small.jpg');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ticket.upload_url);
    expect(init.method).toBe('POST');
    expect((init.body as unknown as RecordingFormData).parts).toEqual([
      ['key', 'artists/a/photo.jpg'],
      ['policy', 'p'],
      ['file', { uri: 'file:///small.jpg', name: 'photo.jpg', type: 'image/jpeg' }, 'photo.jpg'],
    ]);
  });

  it('reports a local blob read failure on web as file_read_error, not network', async () => {
    Platform.OS = 'web';
    const cause = new TypeError('Failed to fetch blob:');
    fetchMock.mockRejectedValueOnce(cause);
    const p = postToStorage(ticket, 'blob:http://localhost/123');
    await expect(p).rejects.toMatchObject({ code: 'file_read_error', cause });
    expect(fetchMock).toHaveBeenCalledTimes(1); // never reached storage
  });
});

describe('postToStorage with a presigned PUT', () => {
  it('PUTs the raw image with the signed headers, not a form', async () => {
    fetchMock.mockResolvedValueOnce({ blob: async () => new Blob(['abc']) }).mockResolvedValueOnce({ ok: true, status: 200 });
    await postToStorage(putTicket, 'file:///small.jpg');
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'file:///small.jpg');
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(putTicket.upload_url);
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({ 'Content-Type': 'image/jpeg' });
    // React Native builds the request's Content-Type from the Blob body, so an untyped Blob signs 403 at R2.
    const body = init.body as Blob;
    expect(body.type).toBe('image/jpeg');
    expect(body.size).toBe(3);
  });

  it('reports an unreadable local file as file_read_error and never reaches storage', async () => {
    const cause = new TypeError('Network request failed');
    fetchMock.mockRejectedValueOnce(cause);
    await expect(postToStorage(putTicket, 'file:///gone.jpg')).rejects.toMatchObject({ code: 'file_read_error', cause });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps a storage rejection (e.g. an expired signature) to upload_failed', async () => {
    fetchMock.mockResolvedValueOnce({ blob: async () => new Blob(['abc']) }).mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(postToStorage(putTicket, 'file:///small.jpg')).rejects.toMatchObject({ code: 'upload_failed', status: 403 });
  });
});

describe('uploadImage', () => {
  beforeEach(() => {
    jest.mocked(artistApi.uploadTicket).mockReset();
  });

  it('reports a failed resize as file_read_error', async () => {
    const cause = new Error('cannot decode');
    manipulatorSaves(Promise.reject(cause));
    await expect(uploadImage(image, 'artist_photo')).rejects.toMatchObject({ code: 'file_read_error', cause });
    expect(artistApi.uploadTicket).not.toHaveBeenCalled();
  });

  it('shrinks, signs, uploads, and reports the stored photo', async () => {
    manipulatorSaves(Promise.resolve({ uri: 'file:///small.jpg', width: 2048.4, height: 1536.6 }));
    jest.mocked(artistApi.uploadTicket).mockResolvedValue(putTicket);
    fetchMock.mockResolvedValueOnce({ blob: async () => new Blob(['abc']) }).mockResolvedValueOnce({ ok: true, status: 200 });
    await expect(uploadImage(image, 'artist_photo')).resolves.toEqual({ key: putTicket.key, width: 2048, height: 1537 });
    expect(fetchMock).toHaveBeenNthCalledWith(2, putTicket.upload_url, expect.objectContaining({ method: 'PUT' }));
  });
});
