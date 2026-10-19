import { Badge } from '@/components/ui/badge'
import type { CustomerStatus } from './types'

const PILL: Record<CustomerStatus, { label: string; variant: 'success' | 'neutral' | 'danger' }> = {
  active: { label: 'Active', variant: 'success' },
  new: { label: 'New', variant: 'neutral' },
  blocked: { label: 'Blocked', variant: 'danger' },
}

export function CustomerStatusPill({ status }: { status: CustomerStatus }) {
  const { label, variant } = PILL[status]
  return <Badge variant={variant}>{label}</Badge>
}
