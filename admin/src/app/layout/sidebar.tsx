import { NavLink } from 'react-router'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDirectorySummary, usePendingCount } from '@/features/artists/queries'
import { useCustomServicePendingCount } from '@/features/custom-services/queries'
import { useEnquirySummary } from '@/features/enquiries/queries'
import { useOverview } from '@/features/overview/queries'
import { useReviewPendingCount } from '@/features/reviews/queries'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, type NavCount } from './nav-items'

const number = new Intl.NumberFormat('en-IN')
const display = (v: string | number) => (typeof v === 'number' ? number.format(v) : v)

/** The design's white "Atelier admin" rail: plain text items, live counts, the signed-in admin at the foot. */
export function Sidebar() {
  const { user, signOut } = useAuth()
  // The queue hooks report "99+" past one page; null or 0 hides the count.
  const counts: Record<NavCount, string | number | null | undefined> = {
    pendingArtists: usePendingCount().data,
    heldEnquiries: useEnquirySummary().data?.counts.held,
    artistsTotal: useDirectorySummary().data?.counts.all,
    bookings30d: useOverview().data?.bookings,
    flaggedReviews: useReviewPendingCount().data,
    pendingCustomServices: useCustomServicePendingCount().data,
  }
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Admin'
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')

  return (
    <aside className="sticky top-0 flex h-svh w-[232px] shrink-0 flex-col border-r border-line bg-sidebar px-3.5 pt-[22px] pb-0 text-sidebar-foreground">
      <div className="px-2 text-[20.3px] font-semibold tracking-[-0.025em]">Atelier <i className="text-primary">admin</i></div>
      <nav aria-label="Primary" className="mt-6 flex flex-col gap-0.5 overflow-y-auto text-[13.5px]">
        {NAV_ITEMS.map(({ to, label, count: key, pill }) => {
          const value = key ? counts[key] : undefined
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between rounded-[10px] px-3 py-[9px] transition-colors hover:bg-halo',
                  isActive ? 'bg-halo font-bold text-primary' : 'font-medium text-foreground',
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
    </aside>
  )
}
