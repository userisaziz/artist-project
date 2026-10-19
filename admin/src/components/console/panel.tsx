import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** White rounded card with the console's soft border; tables, charts and side lists sit in one. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('overflow-hidden rounded-2xl border border-line bg-card', className)}>{children}</section>
}
