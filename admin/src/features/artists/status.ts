import type { ArtistStatus } from '@/lib/types'

type Tone = 'neutral' | 'warning' | 'brand' | 'success' | 'danger'

/** Label and pill tone for every artist status, on the review page and in the directory. */
export const ARTIST_STATUS: Record<ArtistStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'Pending review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  suspended: { label: 'Suspended', tone: 'danger' },
}

/** The Verification queue words it as work to do. */
export const QUEUE_STATUS: Record<ArtistStatus, { label: string; tone: Tone }> = {
  ...ARTIST_STATUS,
  pending: { label: 'Needs review', tone: 'brand' },
}
