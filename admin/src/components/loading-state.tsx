import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  /** What is loading, read out by screen readers and shown under the spinner. */
  label: string
  fullPage?: boolean
}

/** A labelled busy state (role="status"), so a blank screen is never all a visitor gets. */
export function LoadingState({ label, fullPage = false }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('flex flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground', fullPage ? 'min-h-svh' : 'py-16')}
    >
      <Loader2 aria-hidden className="size-5 animate-spin text-primary" />
      <span>{label}…</span>
    </div>
  )
}
