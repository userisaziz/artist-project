import { AMBER, GREEN, NEUTRAL, RED } from '@/features/bookings/status'
import type { AdminReview, ReviewDecision, ReviewFlag, ReviewModerationStatus } from '@/lib/types'

/** In the order the queue's filter chips show them; Flagged is the default. */
export const REVIEW_STATUSES: { value: ReviewModerationStatus; label: string; className: string }[] = [
  { value: 'flagged', label: 'Flagged', className: AMBER },
  { value: 'hidden', label: 'Hidden', className: RED },
  { value: 'published', label: 'Published', className: GREEN },
  { value: 'removed', label: 'Removed', className: NEUTRAL },
]

export const DEFAULT_REVIEW_STATUS: ReviewModerationStatus = 'flagged'

export const REVIEW_STATUS = new Map(REVIEW_STATUSES.map((s) => [s.value, s]))

export const isReviewStatus = (value: string | null): value is ReviewModerationStatus =>
  value !== null && REVIEW_STATUS.has(value as ReviewModerationStatus)

/** `label` for the table, `explanation` for the detail panel. */
export const FLAGS: Record<ReviewFlag, { label: string; explanation: string }> = {
  contact_info: { label: 'Contact details', explanation: 'Contains contact details' },
  blocked_word: { label: 'Blocked word', explanation: 'Contains a blocked word' },
  artist_report: { label: 'Reported by artist', explanation: 'Reported by the artist' },
}

/** The decisions that would change the review: none once it is removed, which is final. */
export function decisionsFor(status: ReviewModerationStatus): ReviewDecision[] {
  switch (status) {
    case 'flagged': return ['publish', 'hide', 'remove']
    case 'hidden': return ['publish', 'remove']
    case 'published': return ['hide', 'remove']
    case 'removed': return []
  }
}

const EXCERPT_LENGTH = 80

/** The first 80 characters, in quotes. */
export function excerpt(text: string | null): string {
  if (!text) return '—'
  const short = text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text
  return `“${short}”`
}

/** The customer → artist line the table and the panel title share. */
export const reviewParties = (r: AdminReview) => `${r.reviewer_name} → ${r.artist.business_name}`
