import { useEffect, useMemo } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { ChatComposer } from './ChatComposer';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useConversation, useMarkRead, useMessages, useSendMessage } from '../../hooks/chat/chat';
import { useNow } from '../../hooks/common/use-now';
import { useKeyboardVisible } from '../../hooks/common/use-keyboard-visible';
import { threadRows } from '../../utils/chat/format';
import type { ChatSide } from '../../types/chat/chat';

const EMPTY: Record<ChatSide, string> = {
  customer: 'Say hello, and ask about dates, designs or a custom quote.',
  artist: 'No messages yet. Say hello to your client.',
};

interface ChatThreadProps {
  side: ChatSide;
  conversationId: string;
}

/** Prototype "Chat with artist" (and the artist's side of it): header, the thread newest at the bottom, the composer.
 *  While focused it polls for new messages and marks the conversation read whenever a new incoming message arrives. */
export function ChatThread({ side, conversationId }: ChatThreadProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const focused = useIsFocused();
  const keyboardUp = useKeyboardVisible();
  const conversation = useConversation(side, conversationId);
  const messages = useMessages(side, conversationId, focused);
  const send = useSendMessage(side, conversationId);
  const markRead = useMarkRead(side, conversationId);
  const items = useMemo(() => messages.data?.pages.flatMap((p) => p.items) ?? [], [messages.data]);
  const rows = useMemo(() => threadRows(items, now), [items, now]);
  const newestIncoming = items.find((m) => m.sender !== side)?.id;
  const { mutate: markAsRead } = markRead;
  const counterpartName = conversation.data?.counterpart.name ?? '';
  const loadFailed = messages.isError && !messages.data;
  const refreshFailed = messages.isError && !!messages.data;

  useEffect(() => {
    if (newestIncoming && focused) markAsRead();
  }, [newestIncoming, focused, markAsRead]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingTop: insets.top + theme.spacing.sm, backgroundColor: theme.colors.surface }}>
        <ChatHeader conversation={conversation.data} />
      </View>
      <View style={{ flex: 1 }}>
        {messages.isPending ? <LoadingView label="Loading messages" /> : null}
        {loadFailed ? <ErrorView error={messages.error} onRetry={() => { void messages.refetch(); }} /> : null}
        {refreshFailed ? <AppText variant="caption" accessibilityLiveRegion="polite" style={{ alignSelf: 'center', color: theme.colors.textMuted, marginTop: 6 }}>Couldn’t refresh. Retrying…</AppText> : null}
        {markRead.isError ? <AppText variant="caption" accessibilityLiveRegion="polite" style={{ alignSelf: 'center', color: theme.colors.textMuted, marginTop: 6 }}>Couldn’t update read status. We’ll try again with the next message.</AppText> : null}
        {messages.isSuccess && !items.length ? <EmptyView message={EMPTY[side]} /> : null}
        {items.length ? (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(row) => row.key}
            renderItem={({ item }) =>
              item.kind === 'day' ? (
                <AppText variant="caption" style={{ alignSelf: 'center', color: theme.colors.textMuted, marginVertical: 10 }}>{item.label}</AppText>
              ) : (
                <MessageBubble message={item.message} mine={item.message.sender === side} author={counterpartName} />
              )
            }
            onEndReached={() => { if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage(); }}
            contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12 }}
          />
        ) : null}
      </View>
      <View style={{ paddingBottom: keyboardUp ? 0 : insets.bottom, backgroundColor: theme.colors.surface }}>
        <ChatComposer sending={send.isPending} error={send.isError ? errorMessage(send.error) : null} onSend={(text) => send.mutateAsync(text)} />
      </View>
    </KeyboardAvoidingView>
  );
}
