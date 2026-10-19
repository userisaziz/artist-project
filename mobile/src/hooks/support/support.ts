import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as supportApi from '../../api/support/support';
import { useAuth } from '../../context/auth/auth-provider';
import type { ReportInput } from '../../types/support/support';

const THREAD_POLL_MS = 15_000;

// Keyed by user id, so another account on the device never sees cached tickets.
export const supportKeys = {
  all: ['support'] as const,
  mine: (userId: string | undefined) => ['support', userId, 'mine'] as const,
  ticket: (userId: string | undefined, id: string) => ['support', userId, 'ticket', id] as const,
};

export function useMyTickets() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: supportKeys.mine(user?.id),
    queryFn: ({ pageParam }) => supportApi.listMyTickets(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

/** One ticket and its thread; re-read while open so support's replies appear. */
export function useMyTicket(id: string, poll = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: supportKeys.ticket(user?.id, id),
    queryFn: () => supportApi.getMyTicket(id),
    enabled: !!user && !!id,
    refetchInterval: poll ? THREAD_POLL_MS : false,
  });
}

export function useReportProblem() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportInput) => supportApi.reportProblem(input),
    onSuccess: (ticket) => {
      client.setQueryData(supportKeys.ticket(user?.id, ticket.id), ticket);
      return client.invalidateQueries({ queryKey: supportKeys.mine(user?.id) });
    },
  });
}

export function useWriteToSupport(id: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => supportApi.writeToSupport(id, text),
    onSuccess: (ticket) => {
      client.setQueryData(supportKeys.ticket(user?.id, id), ticket);
      return client.invalidateQueries({ queryKey: supportKeys.mine(user?.id) });
    },
  });
}
