import { Skeleton } from '@/components/ui/skeleton'

/** Placeholder while a lazily-loaded route chunk arrives: mirrors the console page shape. */
export function PageSkeleton() {
  return (
    <div className="mb-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-80" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
