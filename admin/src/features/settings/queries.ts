import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { City, Policy, TeamMember } from './types'

export const settingsKeys = {
  all: ['admin', 'settings'] as const,
  policies: ['admin', 'settings', 'policies'] as const,
  cities: ['admin', 'settings', 'cities'] as const,
  team: ['admin', 'settings', 'team'] as const,
}

export function usePolicies() {
  return useQuery({ queryKey: settingsKeys.policies, queryFn: () => api<Policy[]>('/admin/settings/policies') })
}

export function useCities() {
  return useQuery({ queryKey: settingsKeys.cities, queryFn: () => api<City[]>('/admin/settings/cities') })
}

export function useTeam() {
  return useQuery({ queryKey: settingsKeys.team, queryFn: () => api<TeamMember[]>('/admin/settings/team') })
}

export function useAddAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (phone: string) => api<TeamMember>('/admin/settings/team', { method: 'POST', body: { phone } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.team }),
  })
}

export function useRemoveAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/admin/settings/team/${id}`, { method: 'DELETE' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.team }),
  })
}
