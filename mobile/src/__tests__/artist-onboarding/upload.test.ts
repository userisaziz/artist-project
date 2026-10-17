import { transport } from '../../core/api/client';
import { MockTransport } from '../../mocks/transport';
import { postToStorage, uploadImage } from '../../api/artist-onboarding/upload';

const mockResize = jest.fn();
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    // 4096×3072 source; resize() scales it the way the native module would.
    manipulate: (uri: string) => {
      let size = { width: 4096, height: 3072 };
      const ctx = {
        resize: (s: { width?: number; height?: number }) => {
          mockResize(s);
          size = s.width ? { width: s.width, height: (3072 / 4096) * s.width } : { width: (4096 / 3072) * s.height!, height: s.height! };
          return ctx;
        },
        renderAsync: async () => ({ saveAsync: async () => ({ uri: `${uri}#small`, ...size }) }),
      };
      return ctx;
    },
  },
}));

beforeEach(() => mockResize.mockReset());

it('shrinks the longest side to 2048, gets a ticket, and registers the file with the mock', async () => {
  const spy = jest.spyOn(transport, 'request').mockResolvedValue({ status: 200, json: { upload_url: 'mock://upload', fields: {}, key: 'artists/u1/portfolio/7' } });
  const out = await uploadImage({ uri: 'file:///big.jpg', width: 4096, height: 3072 }, 'portfolio');
  expect(mockResize).toHaveBeenCalledWith({ width: 2048 });
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', path: '/uploads/signature', body: { purpose: 'portfolio' } }));
  expect(out).toEqual({ key: 'artists/u1/portfolio/7', width: 2048, height: 1536 });
  expect((transport as MockTransport).files.get('artists/u1/portfolio/7')).toBe('file:///big.jpg#small');
  spy.mockRestore();
});

it('leaves images within 2048 px at their size', async () => {
  const spy = jest.spyOn(transport, 'request').mockResolvedValue({ status: 200, json: { upload_url: 'mock://upload', fields: {}, key: 'k' } });
  await uploadImage({ uri: 'file:///small.jpg', width: 1200, height: 900 }, 'portfolio');
  expect(mockResize).not.toHaveBeenCalled();
  spy.mockRestore();
});

it('postToStorage posts the signed fields and the file, and maps failures to ApiError', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  global.fetch = fetchMock as unknown as typeof fetch;
  await postToStorage({ upload_url: 'https://api.cloudinary.com/v1_1/demo/image/upload', fields: { public_id: 'k', signature: 's' }, key: 'k' }, 'file:///a.jpg');
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
  expect(init.method).toBe('POST');
  expect(init.body).toBeInstanceOf(FormData);

  fetchMock.mockResolvedValue({ ok: false, status: 400 });
  await expect(postToStorage({ upload_url: 'https://x', fields: {}, key: 'k' }, 'file:///a.jpg')).rejects.toMatchObject({ code: 'upload_failed' });
  fetchMock.mockRejectedValue(new TypeError('offline'));
  await expect(postToStorage({ upload_url: 'https://x', fields: {}, key: 'k' }, 'file:///a.jpg')).rejects.toMatchObject({ code: 'network_error' });
});
