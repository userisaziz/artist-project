import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
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

/** Sends, shows the message at once (top of the first page), then re-reads the thread for the server's order
 *  and the inbox for its new position. An in-flight poll is cancelled first so it can't overwrite the new message. */
export function useSendMessage(side: ChatSide, id: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => chatApi.sendMessage(side, id, text),
    onSuccess: async (message) => {
      const key = chatKeys.messages(user?.id, side, id);
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<InfiniteData<Page<ChatMessage>>>(key, (data) => {
        if (!data) return data;
        const [first, ...rest] = data.pages;
        return { ...data, pages: [{ ...first, items: [message, ...first.items.filter((m) => m.id !== message.id)] }, ...rest] };
      });
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

/** Opens the chat for an artist (customer side) or a booking (artist side), then pushes the thread.
 *  A failure is shown in an alert; `openingId` is the target being opened, for a busy state. */
export function useChatOpener(side: ChatSide) {
  const router = useRouter();
  const openChat = useOpenChat(side);
  const opening = useRef(false); // a double tap must not push the thread twice
  const open = async (targetId: string) => {
    if (opening.current) return;
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
