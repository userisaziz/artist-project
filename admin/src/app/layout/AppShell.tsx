import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { PageSkeleton } from '@/components/page-skeleton'
import { RouteErrorBoundary } from '@/components/route-error-boundary'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

/** The design's admin console frame: white sidebar, white top bar, pages on the pale console wash. */
export function AppShell() {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex min-w-0 flex-1 flex-col gap-3.5 px-7 py-[22px]">
          {/* keyed by path: a page that crashed recovers when the admin navigates elsewhere */}
          <RouteErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  )
}
