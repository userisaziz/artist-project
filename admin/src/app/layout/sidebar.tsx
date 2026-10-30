import { useState } from 'react'
import { NavLink } from 'react-router'
import { LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useDirectorySummary, usePendingCount } from '@/features/artists/queries'
import { useCustomServicePendingCount } from '@/features/custom-services/queries'
import { useEnquirySummary } from '@/features/enquiries/queries'
import { useUnreadNotificationCount } from '@/features/notifications/queries'
import { useSubcategoryRequestSummary } from '@/features/subcategory-requests/queries'
import { useOverview } from '@/features/overview/queries'
import { useReviewPendingCount } from '@/features/reviews/queries'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, type NavCount } from './nav-items'
import { Logo } from '@/components/ui/logo'
import { preloadPage } from '@/app/page-chunks'

const number = new Intl.NumberFormat('en-IN')
const display = (v: string | number) => (typeof v === 'number' ? number.format(v) : v)

/** The design's white "<brand> admin" rail, shown beside the page from laptop width up. */
export function Sidebar() {
  return (
    <aside className="hidden h-full w-[232px] shrink-0 flex-col border-r border-line bg-sidebar px-3.5 pt-[22px] pb-0 text-sidebar-foreground lg:flex">
      <SidebarContent />
    </aside>
  )
}

/** Below laptop width the rail lives in a drawer, opened from the top bar's menu button; picking a page closes it. */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" title="Open navigation" />}>
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-[264px] gap-0 bg-sidebar px-3.5 pt-[22px] pb-0 text-sidebar-foreground">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}

/** Plain text items, live counts, the signed-in admin at the foot. */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth()
  // The queue hooks report "99+" past one page; null or 0 hides the count.
  const counts: Record<NavCount, string | number | null | undefined> = {
    unreadNotifications: useUnreadNotificationCount().data,
    pendingArtists: usePendingCount().data,
    heldEnquiries: useEnquirySummary().data?.counts.held,
    pendingSubcategories: useSubcategoryRequestSummary().data?.counts.pending,
    artistsTotal: useDirectorySummary().data?.counts.all,
    bookings30d: useOverview().data?.bookings,
    flaggedReviews: useReviewPendingCount().data,
    pendingCustomServices: useCustomServicePendingCount().data,
  }
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Admin'
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')

  return (
    <>
      <Logo size="md" suffix="admin" className="px-2" />
      <nav aria-label="Primary" className="mt-6 flex flex-col gap-0.5 overflow-y-auto overscroll-contain text-[13.5px] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:var(--line)_transparent] focus-within:[scrollbar-color:var(--line)_transparent]">
        {NAV_ITEMS.map(({ to, label, count: key, pill }) => {
          const value = key ? counts[key] : undefined
          return (
            <NavLink
              key={to}
              to={to}
              onPointerEnter={() => preloadPage(to)}
              onFocus={() => preloadPage(to)}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  // The active item's rose tick grows in; colours ease and a press dips the item slightly.
                  'relative flex items-center justify-between rounded-control px-3 py-2.25 transition-[background-color,color,transform] duration-(--motion-fast) ease-snappy hover:bg-halo active:scale-[0.98]',
                  'before:absolute before:top-1/2 before:left-0 before:h-4 before:w-0.75 before:-translate-y-1/2 before:rounded-full before:bg-primary before:transition-transform before:duration-(--motion-base) before:ease-snappy',
                  isActive ? 'bg-halo font-bold text-primary before:scale-y-100' : 'font-medium text-foreground before:scale-y-0',
                )
              }
            >
              <span>{label}</span>
              {value ? (
                pill ? (
                  <span className="rounded-full bg-primary px-2 text-[11.5px] font-bold text-primary-foreground tabular-nums">{display(value)}</span>
                ) : (
                  <span className="text-[11.5px] font-normal text-muted-foreground tabular-nums">{display(value)}</span>
                )
              ) : null}
            </NavLink>
          )
        })}
      </nav>
      <div className="flex-1" />
      <div className="flex items-center gap-2.5 border-t border-line px-2 py-2.5">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">{initials}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold">{name}</div>
          <div className="truncate text-[11px] opacity-70">Admin</div>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut /></Button>
      </div>
    </>
  )
}
