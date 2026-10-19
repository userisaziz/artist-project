import type { KpiTone } from '@/components/console/kpi-tile'

/** Change against the period before, as the design's "▲ 12.4%"; no note when there's no earlier figure to compare. */
export function trend(current: number, previous: number): { note?: string; tone: KpiTone } {
  if (previous === 0) return { tone: 'muted' }
  const pct = ((current - previous) / previous) * 100
  return { note: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`, tone: pct >= 0 ? 'up' : 'alert' }
}
