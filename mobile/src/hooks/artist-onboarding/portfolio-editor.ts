import { useCallback, useEffect, useRef, useState } from 'react';
import { pickImages, uploadImage } from '../../api/artist-onboarding/upload';
import type { PickedImage } from '../../api/artist-onboarding/upload';
import { errorMessage } from '../../core/api/error-message';
import type { PortfolioPhoto } from '../../types/artist-onboarding/artist-onboarding';
import { MAX_PHOTOS } from '../../utils/artist-onboarding/routing';
import { useAddPhoto, useDeletePhoto, useReorderPhotos } from './artist-onboarding';

/** A picked photo that is not in the portfolio yet: on its way up, or stopped with the reason. */
export interface PendingPhoto {
  localId: string;
  image: PickedImage;
  state: 'uploading' | 'failed';
  error?: string;
}

export interface PortfolioEditor {
  pending: PendingPhoto[];
  /** Room left for new photos once the queue lands. */
  canAdd: boolean;
  uploading: boolean;
  add: () => Promise<void>;
  retry: (localId: string) => Promise<void>;
  discard: (localId: string) => void;
  makeCover: (photoId: string) => Promise<void>;
  remove: (photoId: string) => Promise<void>;
  /** A cover or remove in flight. */
  busy: boolean;
  /** The last failure that isn't tied to one pending tile (the picker, a cover change, a removal). */
  error: string | null;
}

let seq = 0;
const nextId = () => { seq += 1; return `pending-${seq}`; };

/**
 * The portfolio's add / retry / cover / remove logic, kept out of the route. Picked photos upload one at a
 * time so the portfolio keeps the order they were picked in. A failed upload stays on the grid with its
 * reason until the artist retries or discards it, instead of vanishing behind one overwritten message.
 */
export function usePortfolioEditor(photos: PortfolioPhoto[]): PortfolioEditor {
  const addPhoto = useAddPhoto();
  const deletePhoto = useDeletePhoto();
  const reorder = useReorderPhotos();
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Leaving the screen mid-queue stops the queue: the photo in flight finishes, the rest are not started.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const patch = (localId: string, next: Partial<PendingPhoto>) =>
    setPending((all) => all.map((p) => (p.localId === localId ? { ...p, ...next } : p)));

  const upload = useCallback(async (item: PendingPhoto) => {
    patch(item.localId, { state: 'uploading', error: undefined });
    try {
      const uploaded = await uploadImage(item.image, 'portfolio');
      await addPhoto.mutateAsync(uploaded);
      setPending((all) => all.filter((p) => p.localId !== item.localId));
    } catch (e) {
      patch(item.localId, { state: 'failed', error: errorMessage(e) });
    }
  }, [addPhoto]);

  const add = async () => {
    setError(null);
    let picked: PickedImage[];
    try {
      picked = await pickImages(MAX_PHOTOS - photos.length - pending.length);
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    const queued = picked.map((image): PendingPhoto => ({ localId: nextId(), image, state: 'uploading' }));
    setPending((all) => [...all, ...queued]);
    for (const item of queued) {
      if (!alive.current) return;
      await upload(item);
    }
  };

  const retry = async (localId: string) => {
    const item = pending.find((p) => p.localId === localId);
    if (item) await upload(item);
  };

  const discard = (localId: string) => setPending((all) => all.filter((p) => p.localId !== localId));

  /** Runs one portfolio write; a failure becomes `error` (visible on the page), never a silent drop. */
  const write = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return {
    pending,
    canAdd: photos.length + pending.length < MAX_PHOTOS,
    uploading: pending.some((p) => p.state === 'uploading'),
    add,
    retry,
    discard,
    makeCover: (id) => write(() => reorder.mutateAsync([id, ...photos.filter((p) => p.id !== id).map((p) => p.id)])),
    remove: (id) => write(() => deletePhoto.mutateAsync(id)),
    busy: reorder.isPending || deletePhoto.isPending,
    error,
  };
}
