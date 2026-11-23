import type { ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const LOADING_ROWS = 6

interface GridMessageProps {
  state: 'loading' | 'error' | 'empty'
  children?: ReactNode
  /** Error only: re-run the failed query, so a transient failure doesn't need a page reload. */
  onRetry?: () => void
}

/** Loading, error or empty body for a table panel, so a list never renders as a blank box. */
export function GridMessage({ state, children, onRetry }: GridMessageProps) {
  if (state === 'loading') {
    return (
      <div role="status" aria-label="Loading" className="space-y-2 p-4">
        {Array.from({ length: LOADING_ROWS }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-[13.5px]">
        <p role="alert" className="text-destructive">{children}</p>
        {onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RotateCw aria-hidden /> Retry</Button>}
      </div>
    )
  }
  return <div className="px-4 py-12 text-center text-[13.5px] text-muted-foreground">{children}</div>
}
