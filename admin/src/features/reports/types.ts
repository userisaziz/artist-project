// Mirrors backend app/report/schemas.py and constants.py. Phase 1 has no in-app payments: no revenue reports.
export type ReportPeriod = '7d' | '30d' | 'quarter' | 'all'
export type ReportName =
  | 'bookings'
  | 'bookings_by_city'
  | 'bookings_by_category'
  | 'bookings_by_week'
  | 'artists'
  | 'reviews'
  | 'support_tickets'

export interface ReportSummary {
  period_days: number | null
  bookings: number
  bookings_previous: number | null
  completed: number
  completion_rate: number | null
  top_city: { name: string; share: number } | null
  top_category: { name: string; share: number } | null
}
