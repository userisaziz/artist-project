import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title: string
  description: string
  onRetry: () => void
  /** Fill the viewport (no shell around it) instead of sitting inside a page. */
  fullPage?: boolean
}

/** A recoverable failure: says what happened and offers Retry. Announced to screen readers as an alert. */
export function ErrorState({ title, description, onRetry, fullPage = false }: ErrorStateProps) {
  return (
    <div className={cn('flex items-center justify-center p-6', fullPage ? 'min-h-svh' : 'py-16')}>
      <div role="alert" className="max-w-sm text-center">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        <Button className="mt-5" variant="outline" onClick={onRetry}>
          <RotateCw /> Retry
        </Button>
      </div>
    </div>
  )
}
