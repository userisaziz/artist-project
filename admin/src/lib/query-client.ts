import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // 4xx answers are final (not found, forbidden, invalid); only retry network/server failures.
      queries: { retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2, staleTime: 30_000 },
    },
  })
}
