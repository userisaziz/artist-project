import { NavLink, Outlet } from 'react-router'
import { BadgeCheck, LayoutGrid, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePendingCount } from '@/features/artists/queries'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/artists', label: 'Verification', icon: BadgeCheck, badge: true },
  { to: '/categories', label: 'Catalog', icon: LayoutGrid, badge: false },
]

/** The design's admin console frame: a white sidebar on the blush page. */
export function AppShell() {
  const { user, signOut } = useAuth()
  const pending = usePendingCount()
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Admin'

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 flex h-svh w-60 shrink-0 flex-col border-r bg-sidebar">
        <div className="border-b px-5 pt-5 pb-4">
          <div className="text-2xl font-semibold tracking-tight">Atelier</div>
          <div className="mt-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Admin console</div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-muted',
                )
              }
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              {badge && pending.data ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground tabular-nums">{pending.data}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 border-t p-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
            {name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{user?.phone}</div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}><LogOut /></Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-8">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
    </div>
  )
}
