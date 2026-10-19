import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Download } from 'lucide-react'
import { FilterChips, type Chip } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { GridHeader } from '@/components/console/grid-header'
import { GridRow } from '@/components/console/grid-row'
import { KpiTile } from '@/components/console/kpi-tile'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { saveTextFile } from '@/lib/download'
import { toastError } from '@/lib/notify'
import { trend } from '@/lib/trend'
import { downloadReport, useReportSummary } from './queries'
import type { ReportName, ReportPeriod } from './types'

const COLUMNS = '2.4fr 1fr .8fr 1fr'
const PERIODS: Chip<ReportPeriod>[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'all', label: 'All time' },
]
const REPORTS: { name: ReportName; title: string; description: string; team: string }[] = [
  { name: 'bookings', title: 'All bookings', description: 'Every booking requested in the period, with its value', team: 'Operations' },
  { name: 'bookings_by_city', title: 'Bookings by city', description: 'Requested, completed and cancelled per city', team: 'Growth' },
  { name: 'bookings_by_category', title: 'Bookings by category', description: 'Requested, completed and cancelled per category', team: 'Growth' },
  { name: 'bookings_by_week', title: 'Bookings by week', description: 'Weekly booking trend (IST weeks)', team: 'Growth' },
  { name: 'artists', title: 'Artists', description: 'Artists who joined in the period, with status', team: 'Operations' },
  { name: 'reviews', title: 'Reviews', description: 'Reviews left in the period, with moderation status', team: 'Operations' },
  { name: 'support_tickets', title: 'Support tickets', description: 'Tickets opened in the period and how they ended', team: 'Operations' },
]
const number = new Intl.NumberFormat('en-IN')
const percent = (share: number | null | undefined) => (share === null || share === undefined ? '—' : `${Math.round(share * 100)}%`)
const isPeriod = (value: string | null): value is ReportPeriod => PERIODS.some((p) => p.value === value)

/** Design "Reports", phase 1: booking figures for a period and on-demand CSV exports (no revenue reports yet). */
export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('period')
  const period: ReportPeriod = isPeriod(raw) ? raw : '30d'
  const summary = useReportSummary(period)
  const s = summary.data
  const bookings = s && s.bookings_previous !== null ? trend(s.bookings, s.bookings_previous) : { tone: 'muted' as const, note: undefined }

  return (
    <>
      <PageHeader title="Reports" subtitle="On-demand exports for operations and growth." />
      <PanelToolbar>
        <FilterChips chips={PERIODS} value={period} onChange={(next) => setParams({ period: next })} />
      </PanelToolbar>
      {summary.isError && !s && <p role="alert" className="text-[13px] text-destructive">Couldn’t load the figures. {summary.error.message}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Bookings" value={s && number.format(s.bookings)} note={bookings.note} tone={bookings.tone} />
        <KpiTile label="Completion rate" value={s && percent(s.completion_rate)} note={s && `${number.format(s.completed)} completed`} />
        <KpiTile label="Top city" value={s && (s.top_city?.name ?? '—')} note={s?.top_city ? `${percent(s.top_city.share)} of bookings` : undefined} />
        <KpiTile label="Top category" value={s && (s.top_category?.name ?? '—')} note={s?.top_category ? `${percent(s.top_category.share)} of bookings` : undefined} />
      </div>
      <Panel className="flex flex-col">
        <GridHeader columns={COLUMNS} labels={['Report', 'Team', 'Format', '']} />
        {REPORTS.map((r) => <ReportRow key={r.name} report={r} period={period} />)}
        <PanelFooter>Files are built on demand from live data.</PanelFooter>
      </Panel>
    </>
  )
}

function ReportRow({ report, period }: { report: (typeof REPORTS)[number]; period: ReportPeriod }) {
  const [busy, setBusy] = useState(false)
  const download = async () => {
    setBusy(true)
    try {
      saveTextFile(await downloadReport(report.name, period), `${report.name}-${period}.csv`)
    } catch (e) {
      toastError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <GridRow columns={COLUMNS}>
      <div className="min-w-0">
        <div className="truncate font-bold">{report.title}</div>
        <div className="truncate text-[11.5px] text-muted-foreground">{report.description}</div>
      </div>
      <span><Badge variant="neutral">{report.team}</Badge></span>
      <span>CSV</span>
      <span className="text-right">
        <Button variant="outline" size="sm" onClick={() => { void download() }} disabled={busy} aria-label={`Download ${report.title}`}>
          <Download aria-hidden /> {busy ? 'Preparing…' : 'Download'}
        </Button>
      </span>
    </GridRow>
  )
}
