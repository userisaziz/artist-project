import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { transport } from '../../core/api/client';
import { MockTransport } from '../../mocks/transport';
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

/** Spec §2: shrink on the device, get a signed form, post straight to storage, and return what our API needs. */
export async function uploadImage(image: PickedImage, purpose: UploadPurpose): Promise<PhotoInput> {
  const small = await shrink(image);
  const ticket = await artistApi.uploadTicket(purpose);
  if (transport instanceof MockTransport) transport.files.set(ticket.key, small.uri);
  else if (!ticket.upload_url.startsWith(FAKE_STORAGE)) await postToStorage(ticket, small.uri);
  return { key: ticket.key, width: Math.round(small.width), height: Math.round(small.height) };
}

async function shrink({ uri, width, height }: PickedImage): Promise<PickedImage> {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_EDGE) ctx.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  const saved = await (await ctx.renderAsync()).saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Multipart POST of the signed fields plus the file. Failures become ApiErrors so screens can show them. */
export async function postToStorage(ticket: UploadTicket, uri: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const form = new FormData();
    for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v);
    if (Platform.OS === 'web') form.append('file', await (await fetch(uri, { signal: controller.signal })).blob(), 'photo.jpg');
    else form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob); // React Native's file part
    const res = await fetch(ticket.upload_url, { method: 'POST', body: form, signal: controller.signal });
    if (!res.ok) throw new ApiError('upload_failed', 'Couldn’t upload that photo. Please try again.', res.status);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('network_error', 'Network unreachable. Check your connection.', 0);
  } finally {
    clearTimeout(timer);
  }
}
