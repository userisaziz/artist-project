import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import * as chatApi from '../../api/chat/chat';
import { useAuth } from '../../context/auth/auth-provider';
import { errorMessage } from '../../core/api/error-message';
import type { Page } from '../../core/api/types';
import type { ChatMessage, ChatSide, Conversation } from '../../types/chat/chat';

// Chat is delivered by polling, only while the screen is focused (`poll`): react-query itself only pauses in the background.
const INBOX_POLL_MS = 15_000;
const THREAD_POLL_MS = 5_000;

// Keyed by user id and side, so another account (or the other side of the same account) never sees cached chats.
export const chatKeys = {
  all: ['chat'] as const,
  inbox: (userId: string | undefined, side: ChatSide, q: string) => ['chat', side, userId, 'inbox', q] as const,
  detail: (userId: string | undefined, side: ChatSide, id: string) => ['chat', side, userId, 'detail', id] as const,
  messages: (userId: string | undefined, side: ChatSide, id: string) => ['chat', side, userId, 'messages', id] as const,
};

export function useConversations(side: ChatSide, q = '', poll = true) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: chatKeys.inbox(user?.id, side, q),
    queryFn: ({ pageParam }) => chatApi.listConversations(side, pageParam, q),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData, // a new search keeps the old rows on screen until it answers
    refetchInterval: poll ? INBOX_POLL_MS : false,
    enabled: !!user,
  });
}

export function useConversation(side: ChatSide, id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: chatKeys.detail(user?.id, side, id),
    queryFn: () => chatApi.getConversation(side, id),
    enabled: !!user && !!id,
  });
}

/** Newest first; render in an inverted list. */
export function useMessages(side: ChatSide, id: string, poll = true) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: chatKeys.messages(user?.id, side, id),
    queryFn: ({ pageParam }) => chatApi.listMessages(side, id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    refetchInterval: poll ? THREAD_POLL_MS : false,
    enabled: !!user && !!id,
  });
}

const PENDING_PREFIX = 'pending-';
let pendingSeq = 0; // two sends in the same millisecond still get their own bubble

/** A message shown before the server has accepted it (useSendMessage), so the bubble can look unsent. */
export const isPendingMessage = (message: ChatMessage) => message.id.startsWith(PENDING_PREFIX);

type MessagePages = InfiniteData<Page<ChatMessage>>;

/** Swaps the first page's items, leaving the rest of the thread as it is. */
function withFirstPage(data: MessagePages | undefined, update: (items: ChatMessage[]) => ChatMessage[]) {
  if (!data) return data;
  const [first, ...rest] = data.pages;
  return { ...data, pages: [{ ...first, items: update(first.items) }, ...rest] };
}

/** Shows the message at once as pending (top of the first page), swaps in the server's copy when it's accepted or
 *  takes it back out if it fails, then re-reads the thread for the server's order and the inbox for its new position.
 *  An in-flight poll is cancelled first so it can't overwrite the new message. */
export function useSendMessage(side: ChatSide, id: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  const key = chatKeys.messages(user?.id, side, id);
  return useMutation({
    mutationFn: (text: string) => chatApi.sendMessage(side, id, text),
    onMutate: async (text) => {
      await client.cancelQueries({ queryKey: key });
      const pending: ChatMessage = { id: `${PENDING_PREFIX}${Date.now()}-${++pendingSeq}`, sender: side, text, created_at: new Date().toISOString(), moderation: null };
      client.setQueryData<MessagePages>(key, (data) => withFirstPage(data, (items) => [pending, ...items]));
      return { pendingId: pending.id };
    },
    onError: (_error, _text, context) =>
      client.setQueryData<MessagePages>(key, (data) => withFirstPage(data, (items) => items.filter((m) => m.id !== context?.pendingId))),
    onSuccess: async (message, _text, context) => {
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<MessagePages>(key, (data) =>
        withFirstPage(data, (items) => [message, ...items.filter((m) => m.id !== message.id && m.id !== context?.pendingId)]));
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ['chat', side, user?.id, 'inbox'] }),
      ]);
    },
  });
}

const MARK_READ_RETRIES = 2;

export function useMarkRead(side: ChatSide, id: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => chatApi.markRead(side, id),
    retry: MARK_READ_RETRIES,
    onSuccess: async (conversation) => {
      client.setQueryData(chatKeys.detail(user?.id, side, id), conversation);
      await client.invalidateQueries({ queryKey: ['chat', side, user?.id, 'inbox'] });
    },
  });
}

/** Opens (or reopens) a chat: customers with an artist, artists from one of their bookings. */
export function useOpenChat(side: ChatSide) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string): Promise<Conversation> =>
      side === 'customer' ? chatApi.openChatWithArtist(targetId) : chatApi.openChatFromBooking(targetId),
    onSuccess: (conversation) => client.setQueryData(chatKeys.detail(user?.id, side, conversation.id), conversation),
  });
}

const CHAT_ROUTE: Record<ChatSide, '/customer/chat/[id]' | '/artist/chat/[id]'> = {
  customer: '/customer/chat/[id]',
  artist: '/artist/chat/[id]',
};

/** The chat already in a cached inbox for this artist (customer side) or booking (artist side), if any. */
function cachedConversation(client: QueryClient, userId: string | undefined, side: ChatSide, targetId: string) {
  const inboxes = client.getQueriesData<InfiniteData<Page<Conversation>>>({ queryKey: ['chat', side, userId, 'inbox'] });
  const matches = (c: Conversation) => (side === 'customer' ? c.counterpart.id === targetId : c.booking?.id === targetId);
  for (const [, data] of inboxes) {
    const found = data?.pages.flatMap((p) => p.items).find(matches);
    if (found) return found;
  }
  return undefined;
}

/** Opens the chat for an artist (customer side) or a booking (artist side), then pushes the thread. A chat already in
 *  the inbox opens at once; otherwise it's created first. A failure is shown in an alert; `openingId` is the target
 *  being opened, for a busy state. */
export function useChatOpener(side: ChatSide) {
  const router = useRouter();
  const { user } = useAuth();
  const client = useQueryClient();
  const openChat = useOpenChat(side);
  const opening = useRef(false); // a double tap must not push the thread twice
  const open = async (targetId: string) => {
    if (opening.current) return;
    const known = cachedConversation(client, user?.id, side, targetId);
    if (known) {
      router.push({ pathname: CHAT_ROUTE[side], params: { id: known.id } });
      return;
    }
    opening.current = true;
    try {
      const conversation = await openChat.mutateAsync(targetId);
      router.push({ pathname: CHAT_ROUTE[side], params: { id: conversation.id } });
    } catch (e) {
      Alert.alert('Couldn’t open the chat', errorMessage(e));
    } finally {
      opening.current = false;
    }
  };
  return { open, openingId: openChat.isPending ? openChat.variables : undefined };
}
