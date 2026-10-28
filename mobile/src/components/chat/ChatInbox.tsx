import { useState, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { ConversationRow } from './ConversationRow';
import { useTheme } from '../../core/theme/theme-provider';
import { useConversations } from '../../hooks/chat/chat';
import { useDebouncedValue } from '../../hooks/common/use-debounced-value';
import { useNow } from '../../hooks/common/use-now';
import type { ChatSide } from '../../types/chat/chat';
import { usePullToRefresh } from '../../hooks/common/use-pull-to-refresh';

const MAX_QUERY = 100;
const EMPTY: Record<ChatSide, string> = {
  artist: 'No messages yet. Clients who write to you show up here.',
  customer: 'No messages yet. Message an artist from their profile.',
};

interface ChatInboxProps {
  side: ChatSide;
  /** Artists can search clients by name; the customer inbox has no search. */
  searchable?: boolean;
  onOpen: (conversationId: string) => void;
  header?: ReactNode;
}

/** Prototype Messages: the title, "Search clients", and one row per conversation, latest first. */
export function ChatInbox({ side, searchable = false, onOpen, header }: ChatInboxProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim());
  const inbox = useConversations(side, searchable ? q : '', useIsFocused());
  const pull = usePullToRefresh(inbox.refetch);
  const items = inbox.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.md, paddingHorizontal: theme.spacing.md }}>
      {header ?? <AppText variant="display" style={{ fontSize: 30, lineHeight: 34, color: theme.colors.heading }}>Messages</AppText>}
      {searchable ? (
        <View style={{ marginTop: 12 }}>
          <AppTextField label="Search clients" hideLabel placeholder="Search clients" value={query} onChangeText={setQuery} maxLength={MAX_QUERY} autoCorrect={false} />
        </View>
      ) : null}
      {inbox.isPending ? <LoadingView label="Loading messages" /> : null}
      {inbox.isError && !inbox.data ? <ErrorView error={inbox.error} onRetry={() => { void inbox.refetch(); }} /> : null}
      {inbox.isError && inbox.data ? <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: theme.colors.textMuted, marginTop: 8 }}>Couldn’t refresh. Retrying…</AppText> : null}
      {inbox.isSuccess && !items.length ? <EmptyView message={q ? `No clients match “${q}”.` : EMPTY[side]} /> : null}
      {items.length ? (
        <FlatList
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ConversationRow conversation={item} now={now} onPress={() => onOpen(item.id)} />}
          onEndReached={() => { if (inbox.hasNextPage && !inbox.isFetchingNextPage) void inbox.fetchNextPage(); }}
          contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xl }}
        />
      ) : null}
    </View>
  );
}
