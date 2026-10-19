import { Badge } from '@/components/ui/badge'
import type { BookingStatus } from '@/lib/types'
import { BY_VALUE } from './status'

export function BookingStatusPill({ status }: { status: BookingStatus }) {
  const s = BY_VALUE.get(status)
  return <Badge variant={s?.tone ?? 'neutral'}>{s?.label ?? status}</Badge>
}
