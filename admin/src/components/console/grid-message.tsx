import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const LOADING_ROWS = 6

/** Loading, error or empty body for a table panel, so a list never renders as a blank box. */
export function GridMessage({ state, children }: { state: 'loading' | 'error' | 'empty'; children?: ReactNode }) {
  if (state === 'loading') {
    return (
      <div role="status" aria-label="Loading" className="space-y-2 p-4">
        {Array.from({ length: LOADING_ROWS }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    )
  }
  return (
    <div role={state === 'error' ? 'alert' : undefined} className={state === 'error' ? 'px-4 py-12 text-center text-[13.5px] text-destructive' : 'px-4 py-12 text-center text-[13.5px] text-muted-foreground'}>
      {children}
    </div>
  )
}
