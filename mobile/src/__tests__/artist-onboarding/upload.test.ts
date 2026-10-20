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
const ticket: UploadTicket = { upload_url: 'https://storage.example.com/bucket', fields: { key: 'artists/a/photo.jpg', policy: 'p' }, key: 'artists/a/photo.jpg' };
const fakeTicket: UploadTicket = { ...ticket, upload_url: 'https://fake.storage/bucket' };
const image = { uri: 'file:///photo.jpg', width: 4000, height: 3000 };

const realFetch = global.fetch;
const realFormData = global.FormData;
/** React Native's FormData accepts a {uri, name, type} file part; Node's (jest) does not, so record parts instead. */
class RecordingFormData {
  parts: [string, unknown][] = [];
  append(name: string, value: unknown): void { this.parts.push([name, value]); }
}
const fetchMock = jest.fn();
const dev = (global as { __DEV__?: boolean }).__DEV__;
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
  (global as { __DEV__?: boolean }).__DEV__ = dev;
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

  it('reports a local blob read failure on web as file_read_error, not network', async () => {
    Platform.OS = 'web';
    const cause = new TypeError('Failed to fetch blob:');
    fetchMock.mockRejectedValueOnce(cause);
    const p = postToStorage(ticket, 'blob:http://localhost/123');
    await expect(p).rejects.toMatchObject({ code: 'file_read_error', cause });
    expect(fetchMock).toHaveBeenCalledTimes(1); // never reached storage
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

  it('skips the storage post for the fake storage provider in development', async () => {
    manipulatorSaves(Promise.resolve({ uri: 'file:///small.jpg', width: 2048, height: 1536 }));
    jest.mocked(artistApi.uploadTicket).mockResolvedValue(fakeTicket);
    await expect(uploadImage(image, 'artist_photo')).resolves.toEqual({ key: fakeTicket.key, width: 2048, height: 1536 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never skips the storage post in a release build', async () => {
    (global as { __DEV__?: boolean }).__DEV__ = false;
    manipulatorSaves(Promise.resolve({ uri: 'file:///small.jpg', width: 2048, height: 1536 }));
    jest.mocked(artistApi.uploadTicket).mockResolvedValue(fakeTicket);
    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    await uploadImage(image, 'artist_photo');
    expect(fetchMock).toHaveBeenCalledWith(fakeTicket.upload_url, expect.objectContaining({ method: 'POST' }));
  });
});
