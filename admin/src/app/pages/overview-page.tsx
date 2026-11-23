import { VerificationQueuePanel } from '@/features/artists/components/verification-queue-panel'
import { OverviewPage } from '@/features/overview/OverviewPage'

/** Overview with the artists feature's queue preview composed in at the route. */
export function OverviewRoute() {
  return <OverviewPage queuePanel={<VerificationQueuePanel />} />
}
