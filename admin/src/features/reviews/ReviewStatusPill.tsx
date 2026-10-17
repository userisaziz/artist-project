import { NEUTRAL } from '@/features/bookings/status'
import type { ReviewModerationStatus } from '@/lib/types'
import { REVIEW_STATUS } from './status'

export function ReviewStatusPill({ status }: { status: ReviewModerationStatus }) {
  const s = REVIEW_STATUS.get(status)
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${s?.className ?? NEUTRAL}`}>{s?.label ?? status}</span>
}
