import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as quotesApi from '../../api/quotes/quotes';
import { useAuth } from '../../context/auth/auth-provider';
import type { AcceptQuoteInput, ArtistEnquiryScope, Enquiry, EnquiryInput, QuoteInput } from '../../types/quotes/quotes';

// Keyed by user id, so another account on the device never sees cached enquiries.
export const quoteKeys = {
  all: ['quotes'] as const,
  customer: (userId: string | undefined) => ['quotes', 'customer', userId] as const,
  customerList: (userId: string | undefined) => ['quotes', 'customer', userId, 'list'] as const,
  customerDetail: (userId: string | undefined, id: string) => ['quotes', 'customer', userId, 'detail', id] as const,
  availability: (userId: string | undefined, id: string, date: string) => ['quotes', 'customer', userId, 'availability', id, date] as const,
  artist: (userId: string | undefined) => ['quotes', 'artist', userId] as const,
  artistList: (userId: string | undefined, scope: ArtistEnquiryScope) => ['quotes', 'artist', userId, 'list', scope] as const,
  artistDetail: (userId: string | undefined, id: string) => ['quotes', 'artist', userId, 'detail', id] as const,
  summary: (userId: string | undefined) => ['quotes', 'artist', userId, 'summary'] as const,
};

// ---- Customer ----

export function useMyEnquiries() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: quoteKeys.customerList(user?.id),
    queryFn: ({ pageParam }) => quotesApi.listMyEnquiries(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

export function useEnquiry(id: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: quoteKeys.customerDetail(user?.id, id), queryFn: () => quotesApi.getEnquiry(id), enabled: !!user && !!id });
}

/** Open starts for the quoted duration on one IST date. */
export function useQuoteAvailability(id: string, date: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: quoteKeys.availability(user?.id, id, date),
    queryFn: () => quotesApi.getQuoteAvailability(id, date),
    enabled: !!user && !!id && !!date,
    staleTime: 0, // slots go fast: always refetch when the date is shown again
  });
}

/** Caches the returned enquiry and refreshes the customer's list (and slots) around it. */
function useCustomerEnquiryWrite<TVars, TResult>(write: (vars: TVars) => Promise<TResult>, enquiryOf: (r: TResult) => Enquiry) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSuccess: async (result) => {
      const enquiry = enquiryOf(result);
      client.setQueryData(quoteKeys.customerDetail(user?.id, enquiry.id), enquiry);
      await client.invalidateQueries({ queryKey: quoteKeys.customer(user?.id), predicate: (q) => q.queryKey[3] !== 'detail' });
    },
  });
}

export const useCreateEnquiry = () => useCustomerEnquiryWrite((body: EnquiryInput) => quotesApi.createEnquiry(body), (e) => e);
export const useCancelEnquiry = () => useCustomerEnquiryWrite((id: string) => quotesApi.cancelEnquiry(id), (e) => e);
export const useAcceptQuote = () =>
  useCustomerEnquiryWrite(({ id, body }: { id: string; body: AcceptQuoteInput }) => quotesApi.acceptQuote(id, body), (r) => r.enquiry);

/** After a taken slot: refetch this enquiry's slots so the grid drops it. */
export function useRefreshQuoteSlots(id: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: [...quoteKeys.customer(user?.id), 'availability', id] });
}

// ---- Artist ----

export function useArtistEnquiries(scope: ArtistEnquiryScope) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: quoteKeys.artistList(user?.id, scope),
    queryFn: ({ pageParam }) => quotesApi.listArtistEnquiries(scope, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

export function useArtistEnquiry(id: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: quoteKeys.artistDetail(user?.id, id), queryFn: () => quotesApi.getArtistEnquiry(id), enabled: !!user && !!id });
}

export function useEnquirySummary() {
  const { user } = useAuth();
  return useQuery({ queryKey: quoteKeys.summary(user?.id), queryFn: quotesApi.getEnquirySummary, enabled: !!user });
}

/** Caches the returned enquiry and refreshes the artist's tabs and summary. */
function useArtistEnquiryWrite<TVars>(write: (vars: TVars) => Promise<Enquiry>) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSuccess: async (enquiry) => {
      client.setQueryData(quoteKeys.artistDetail(user?.id, enquiry.id), enquiry);
      await client.invalidateQueries({ queryKey: quoteKeys.artist(user?.id), predicate: (q) => q.queryKey[3] !== 'detail' });
    },
  });
}

export const useSendQuote = () => useArtistEnquiryWrite(({ id, body }: { id: string; body: QuoteInput }) => quotesApi.sendQuote(id, body));
export const useDeclineEnquiry = () => useArtistEnquiryWrite(({ id, reason }: { id: string; reason: string | null }) => quotesApi.declineEnquiry(id, reason));
