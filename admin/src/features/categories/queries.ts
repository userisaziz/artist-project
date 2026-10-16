import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AdminCategory, CategoryInput, ServiceTemplate, ServiceTemplateInput } from '@/lib/types'

export const categoryKeys = { all: ['admin', 'categories'] as const }
export const templateKeys = {
  all: ['admin', 'service-templates'] as const,
  list: (subId: number) => ['admin', 'service-templates', subId] as const,
}

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

/** The service list under one subcategory; idle until one is picked. */
export function useServiceTemplates(subId: number | null) {
  return useQuery({
    queryKey: templateKeys.list(subId ?? 0),
    queryFn: () => api<ServiceTemplate[]>(`/admin/service-templates?subcategory_id=${subId}`),
    enabled: subId !== null,
  })
}

/** Templates also move the subcategory's template_count, so both lists refetch. */
function useInvalidateTemplates() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: templateKeys.all }),
      queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
    ])
}

export function useSaveServiceTemplate() {
  const invalidate = useInvalidateTemplates()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: Partial<ServiceTemplateInput> }) =>
      id === undefined
        ? api<ServiceTemplate>('/admin/service-templates', { method: 'POST', body: input })
        : api<ServiceTemplate>(`/admin/service-templates/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteServiceTemplate() {
  const invalidate = useInvalidateTemplates()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/admin/service-templates/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
