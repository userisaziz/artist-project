import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { UserPlus } from 'lucide-react'
import { FilterChips, type Chip } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { CellLabel } from '@/components/console/cell-label'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { GridRow } from '@/components/console/grid-row'
import { KpiTile } from '@/components/console/kpi-tile'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AddAdminDialog } from './AddAdminDialog'
import { RequirementsPanel } from './RequirementsPanel'
import { TeamPanel } from './TeamPanel'
import { useCities, usePolicies, useTeam } from './queries'
import type { SettingsTab } from './types'

const TABS: Chip<SettingsTab>[] = [
  { value: 'policies', label: 'Policies' },
  { value: 'requirements', label: 'Profile requirements' },
  { value: 'cities', label: 'Cities' },
  { value: 'team', label: 'Team & roles' },
]
const POLICY_COLUMNS = '1.6fr 2.4fr 1fr'
const CITY_COLUMNS = '2fr 1fr 1fr'
const number = new Intl.NumberFormat('en-IN')
const isTab = (value: string | null): value is SettingsTab => TABS.some((t) => t.value === value)

/** Design "Settings", phase 1: booking rules (read-only), cities and team access. Fees and payouts come with payments. */
export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: SettingsTab = isTab(raw) ? raw : 'policies'
  const cities = useCities().data
  const team = useTeam().data
  const [adding, setAdding] = useState(false)

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Booking rules, profile requirements, cities and team access."
        action={tab === 'team' && <Button size="page" onClick={() => setAdding(true)}><UserPlus aria-hidden className="size-4" /> Add admin</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Live cities" value={cities && number.format(cities.filter((c) => c.artists > 0).length)} note={cities && `of ${number.format(cities.length)} open`} />
        <KpiTile label="Team members" value={team && number.format(team.length)} note="Admins" />
        <KpiTile label="Payments" value="Direct" note="Paid to artists after the service" />
        <KpiTile label="Fees & payouts" value="Phase 2" note="With in-app payments" />
      </div>
      <Panel className="flex flex-col">
        <PanelToolbar>
          <FilterChips chips={TABS} value={tab} onChange={(next) => setParams({ tab: next })} />
        </PanelToolbar>
        {tab === 'policies' && <PoliciesPanel />}
        {tab === 'requirements' && <RequirementsPanel />}
        {tab === 'cities' && <CitiesPanel />}
        {tab === 'team' && <TeamPanel />}
      </Panel>
      <AddAdminDialog open={adding} onClose={() => setAdding(false)} />
    </>
  )
}

function PoliciesPanel() {
  const policies = usePolicies()
  return (
    <>
      <GridHeader columns={POLICY_COLUMNS} labels={['Setting', 'Current value', 'Scope']} />
      {policies.isPending && <GridMessage state="loading" />}
      {policies.isError && <GridMessage state="error">Couldn’t load the booking rules. {policies.error.message}</GridMessage>}
      {policies.data?.map((p) => (
        <GridRow key={p.key} columns={POLICY_COLUMNS}>
          <span className="font-bold">{p.label}</span>
          <span>{p.value}</span>
          <span><Badge variant="neutral">{p.scope}</Badge></span>
        </GridRow>
      ))}
      {policies.isSuccess && <PanelFooter>Set in server configuration; changes apply to new bookings only.</PanelFooter>}
    </>
  )
}

function CitiesPanel() {
  const cities = useCities()
  return (
    <>
      <GridHeader columns={CITY_COLUMNS} labels={['City', 'Approved artists', 'Bookings · 30d']} />
      {cities.isPending && <GridMessage state="loading" />}
      {cities.isError && <GridMessage state="error">Couldn’t load the cities. {cities.error.message}</GridMessage>}
      {cities.data?.map((c) => (
        <GridRow key={c.name} columns={CITY_COLUMNS}>
          <span className="font-bold">{c.name}</span>
          <span className="tabular-nums"><CellLabel>Artists</CellLabel>{number.format(c.artists)}</span>
          <span className="tabular-nums"><CellLabel>Bookings · 30d</CellLabel>{number.format(c.bookings_30d)}</span>
        </GridRow>
      ))}
    </>
  )
}
