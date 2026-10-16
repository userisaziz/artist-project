import type { BookingStatus } from '@/lib/types'
import { BY_VALUE, NEUTRAL } from './status'

export function BookingStatusPill({ status }: { status: BookingStatus }) {
  const s = BY_VALUE.get(status)
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${s?.className ?? NEUTRAL}`}>{s?.label ?? status}</span>
}
