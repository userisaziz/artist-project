import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ApiError } from '../../core/api/types';
import type { PhotoInput, UploadPurpose, UploadTicket } from '../../types/artist-onboarding/artist-onboarding';
import * as artistApi from './artist-onboarding';

const MAX_EDGE = 2048; // spec §2: longest side
const QUALITY = 0.8;   // spec §2: JPEG quality
const UPLOAD_TIMEOUT_MS = 60_000; // uploads carry a whole photo, so they get longer than an API call
// Backend STORAGE_PROVIDER=fake hands out this URL; there is nothing to post to, so dev skips the upload.
const FAKE_STORAGE = 'https://fake.storage/';

export interface PickedImage { uri: string; width: number; height: number }

/** Opens the photo library; [] when the user cancels. */
export async function pickImages(limit: number): Promise<PickedImage[]> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: limit > 1, selectionLimit: limit, quality: 1 });
  if (res.canceled) return [];
  return res.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/** Spec §2: shrink on the device, get a signed upload, send straight to storage, and return what our API needs. */
export async function uploadImage(image: PickedImage, purpose: UploadPurpose): Promise<PhotoInput> {
  const small = await shrink(image);
  const ticket = await artistApi.uploadTicket(purpose);
  // Dev-only: STORAGE_PROVIDER=fake has nothing to post to. A release build always posts, so a misconfigured
  // backend fails loudly instead of "uploading" photos that never exist.
  const skipUpload = __DEV__ && ticket.upload_url.startsWith(FAKE_STORAGE);
  if (!skipUpload) await postToStorage(ticket, small.uri);
  return { key: ticket.key, width: Math.round(small.width), height: Math.round(small.height) };
}

const fileReadError = (cause: unknown): ApiError =>
  new ApiError('file_read_error', 'Couldn’t read that photo. Please choose it again.', 0, { cause });

/** Only a failed connection or a timeout is a network error; anything else is a bug and propagates as-is. */
const isNetworkFailure = (e: unknown): boolean => e instanceof TypeError || (e instanceof Error && e.name === 'AbortError');

async function shrink({ uri, width, height }: PickedImage): Promise<PickedImage> {
  try {
    const ctx = ImageManipulator.manipulate(uri);
    if (Math.max(width, height) > MAX_EDGE) ctx.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
    const saved = await (await ctx.renderAsync()).saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
    return { uri: saved.uri, width: saved.width, height: saved.height };
  } catch (e) {
    throw fileReadError(e);
  }
}

/** Reads a local file (file:// on native, blob: on web) into a Blob; a failure here is the file, not the network. */
async function localBlob(uri: string): Promise<Blob> {
  try {
    return await (await fetch(uri)).blob();
  } catch (e) {
    throw fileReadError(e);
  }
}

/** The multipart file part. Web reads the local blob first; native hands React Native the file URI. */
async function filePart(uri: string): Promise<Blob> {
  if (Platform.OS !== 'web') return { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob; // React Native's file part
  return localBlob(uri);
}

/** POST: multipart form of the signed fields plus the file (Cloudinary). PUT: the raw file with the signed headers (R2). */
async function storageRequest(ticket: UploadTicket, uri: string): Promise<RequestInit> {
  if (ticket.method === 'PUT') return { method: 'PUT', headers: ticket.headers, body: await localBlob(uri) };
  const form = new FormData();
  for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v);
  form.append('file', await filePart(uri), 'photo.jpg');
  return { method: 'POST', body: form };
}

/** Sends the file to storage as the ticket says. Failures become ApiErrors so screens can show them. */
export async function postToStorage(ticket: UploadTicket, uri: string): Promise<void> {
  const request = await storageRequest(ticket, uri);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(ticket.upload_url, { ...request, signal: controller.signal });
  } catch (e) {
    if (isNetworkFailure(e)) throw new ApiError('network_error', 'Network unreachable. Check your connection.', 0, { cause: e });
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new ApiError('upload_failed', 'Couldn’t upload that photo. Please try again.', res.status);
}
