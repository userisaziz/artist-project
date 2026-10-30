import { Suspense, useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { preloadAllPages } from '@/app/page-chunks'
import { PageSkeleton } from '@/components/page-skeleton'
import { RouteErrorBoundary } from '@/components/route-error-boundary'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { useScrollRestoration } from './use-scroll-restoration'

const IDLE_TIMEOUT_MS = 2000

/**
 * The design's admin console frame: white sidebar, white top bar, pages on the pale console wash.
 * The frame is fixed and only the page area scrolls, so the sidebar and top bar never move.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const scrollRef = useRef<HTMLElement>(null)
  const scrolled = useScrollRestoration(scrollRef)

  // Once the first page is up, fetch the other pages' code in the background: navigation never waits on it.
  useEffect(() => {
    const id = window.requestIdleCallback
      ? window.requestIdleCallback(preloadAllPages, { timeout: IDLE_TIMEOUT_MS })
      : window.setTimeout(preloadAllPages, IDLE_TIMEOUT_MS)
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : window.clearTimeout(id))
  }, [])

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar elevated={scrolled} />
        <main ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-7 md:py-[22px] [scrollbar-gutter:stable]">
          {/* keyed by path: a page that crashed recovers when the admin navigates elsewhere */}
          <RouteErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PageSkeleton />}>
              {/* keyed by path: each page fades and rises in (opacity + transform only, so it stays on the GPU) */}
              <div key={pathname} className="flex min-w-0 flex-col gap-3.5 animate-in fade-in slide-in-from-bottom-1 duration-(--motion-base) ease-snappy">
                <Outlet />
              </div>
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  )
}
