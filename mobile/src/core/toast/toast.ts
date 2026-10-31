import { useSyncExternalStore } from 'react';

/** Transient feedback: one line the app says and takes back on its own. Confirmations ("Cancel this
 *  order?") are a dialogue, not a toast — they keep their buttons and stay `Alert`/a sheet. */
export type ToastTone = 'success' | 'error';

export interface ToastMessage {
  readonly id: number;
  readonly tone: ToastTone;
  readonly title: string;
  readonly body?: string;
}

/** Long enough to read a title and a short body, short enough to be gone before it is in the way. */
const TOAST_MS = 4000;

let current: ToastMessage | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function publish(next: ToastMessage | null): void {
  current = next;
  for (const listener of listeners) listener();
}

/** Show one line of feedback and let it go by itself. The newest message replaces the one on screen
 *  instead of queueing: three failed mutations in a row are one sentence, not three cards. */
export function toast(tone: ToastTone, title: string, body?: string): void {
  seq += 1;
  publish({ id: seq, tone, title, body });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; publish(null); }, TOAST_MS);
}

export function dismissToast(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  publish(null);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The message on screen, or null. A store rather than a context so a plain hook
 *  (`src/hooks/**`) can raise a toast without threading a provider through the screen. */
export function useToastMessage(): ToastMessage | null {
  return useSyncExternalStore(subscribe, () => current);
}

/** The same value without a subscription — for code that is not a component (tests assert on it). */
export function currentToast(): ToastMessage | null {
  return current;
}
