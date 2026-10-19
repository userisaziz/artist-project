import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ReportName, ReportPeriod, ReportSummary } from './types'

export const reportKeys = {
  all: ['admin', 'reports'] as const,
  summary: (period: ReportPeriod) => ['admin', 'reports', 'summary', period] as const,
}

export function useReportSummary(period: ReportPeriod) {
  return useQuery({
    queryKey: reportKeys.summary(period),
    queryFn: () => api<ReportSummary>(`/admin/reports/summary?period=${period}`),
    placeholderData: keepPreviousData,
  })
}

/** One report as CSV text for the period (the page saves it as a file). */
export function downloadReport(report: ReportName, period: ReportPeriod) {
  return api<string>(`/admin/reports/${report}.csv?period=${period}`, { parse: 'text' })
}
