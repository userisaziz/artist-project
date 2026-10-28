import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '../common/BackHeader';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { EnquiryRow } from './EnquiryRow';
import { useTheme } from '../../core/theme/theme-provider';
import { useMyEnquiries } from '../../hooks/quotes/quotes';
import { CUSTOMER_ENQUIRY_PILL } from '../../utils/quotes/status';
import { usePullToRefresh } from '../../hooks/common/use-pull-to-refresh';

/** Profile → My quotes: every enquiry the customer has sent, newest first. */
export function CustomerEnquiries({ onOpen }: { onOpen: (id: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const enquiries = useMyEnquiries();
  const pull = usePullToRefresh(enquiries.refetch);
  const items = enquiries.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
      <BackHeader title="My quotes" />
      {enquiries.isPending ? <LoadingView label="Loading your quotes" /> : null}
      {enquiries.isError && !enquiries.data ? <ErrorView error={enquiries.error} onRetry={() => { void enquiries.refetch(); }} /> : null}
      {enquiries.isSuccess && !items.length ? <EmptyView message="No quote requests yet. Ask an artist for one from their page." /> : null}
      <FlatList
        refreshing={pull.refreshing}
        onRefresh={pull.onRefresh}
        data={items}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingVertical: 12, gap: 10, paddingBottom: insets.bottom + theme.spacing.xl }}
        onEndReached={() => { if (enquiries.hasNextPage && !enquiries.isFetchingNextPage) void enquiries.fetchNextPage(); }}
        renderItem={({ item }) => <EnquiryRow enquiry={item} title={item.artist.business_name} pill={CUSTOMER_ENQUIRY_PILL[item.status]} onPress={() => onOpen(item.id)} />}
      />
    </View>
  );
}
