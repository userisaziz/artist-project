import { Badge } from '@/components/ui/badge'
import type { ReviewModerationStatus } from '@/lib/types'
import { REVIEW_STATUS } from './status'

export function ReviewStatusPill({ status }: { status: ReviewModerationStatus }) {
  const s = REVIEW_STATUS.get(status)
  return <Badge variant={s?.tone ?? 'neutral'}>{s?.label ?? status}</Badge>
}
