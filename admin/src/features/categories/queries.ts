import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AdminCategory, CategoryInput } from '@/lib/types'

export const categoryKeys = { all: ['admin', 'categories'] as const }

export function useCategories() {
  return useQuery({ queryKey: categoryKeys.all, queryFn: () => api<AdminCategory[]>('/admin/categories') })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: categoryKeys.all })
}

export function useSaveCategory() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: Partial<CategoryInput> }) =>
      id === undefined
        ? api<AdminCategory>('/admin/categories', { method: 'POST', body: input })
        : api<AdminCategory>(`/admin/categories/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteCategory() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/admin/categories/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
