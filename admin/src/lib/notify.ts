import { toast } from 'sonner'
import { ApiError, SESSION_EXPIRED } from './api'

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

/** What to tell the admin about a failed call; null when nothing should be said. */
export function errorMessage(error: unknown, fallback: string = GENERIC_MESSAGE): string | null {
  // An expired session is already redirecting to sign-in; an error on top of that would only alarm.
  if (error instanceof ApiError && error.code === SESSION_EXPIRED) return null
  return error instanceof ApiError ? error.message : fallback
}

/** The one place failed mutations become toasts. */
export function toastError(error: unknown, fallback?: string): void {
  const message = errorMessage(error, fallback)
  if (message !== null) toast.error(message)
}
