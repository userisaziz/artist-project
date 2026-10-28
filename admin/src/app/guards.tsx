import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { useAuth } from '@/lib/auth-context'
import { HOME_PATH, PATHS } from '@/lib/paths'
import { brand } from '@/lib/brand'

/** Where a guarded page sends the visitor, so sign-in can bring them back. */
interface FromState {
  from?: string
}

/** While the load-time refresh is unsettled: a labelled spinner, or (server unreachable) a Retry that keeps the session. */
function SessionPending() {
  const { status, retryRestore } = useAuth()
  if (status === 'unavailable') {
    return (
      <ErrorState
        fullPage
        title={`We couldn’t reach ${brand.name}`}
        description="Your session is still here. Check your connection, then retry."
        onRetry={retryRestore}
      />
    )
  }
  return <LoadingState fullPage label="Restoring your session" />
}

/** Wraps every console route: signed-out visitors go to /login, remembering where they were headed. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'restoring' || status === 'unavailable') return <SessionPending />
  if (status === 'signedOut') {
    const from = `${location.pathname}${location.search}`
    return <Navigate to={PATHS.login} replace state={{ from } satisfies FromState} />
  }
  return <Outlet />
}

/** Wraps /login: once signed in, continue to the page that was asked for (or the Overview). */
export function GuestOnly() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'restoring' || status === 'unavailable') return <SessionPending />
  if (status === 'signedIn') {
    const from = (location.state as FromState | null)?.from
    return <Navigate to={from && from !== PATHS.login ? from : HOME_PATH} replace />
  }
  return <Outlet />
}
