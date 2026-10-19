import { Badge } from '@/components/ui/badge'
import type { OrderStatus } from './types'

const PILL = {
  placed: { label: 'To pack', variant: 'warning' },
  confirmed: { label: 'Confirmed', variant: 'brand' },
  shipped: { label: 'Shipped', variant: 'success' },
  delivered: { label: 'Delivered', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
} as const

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const { label, variant } = PILL[status]
  return <Badge variant={variant}>{label}</Badge>
}
