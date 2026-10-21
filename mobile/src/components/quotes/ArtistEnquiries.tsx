import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '../common/BackHeader';
import { Segmented } from '../common/Segmented';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { EnquiryRow } from './EnquiryRow';
import { useTheme } from '../../core/theme/theme-provider';
import { useArtistEnquiries, useEnquirySummary } from '../../hooks/quotes/quotes';
import { ARTIST_ENQUIRY_PILL, customerShortName } from '../../utils/quotes/status';
import type { ArtistEnquiryScope } from '../../types/quotes/quotes';

const EMPTY: Record<ArtistEnquiryScope, string> = {
  open: 'No new enquiries. Customers can ask for a quote from your page.',
  quoted: 'No quotes waiting on a customer.',
  closed: 'Nothing closed yet.',
};

const withCount = (label: string, n: number | undefined) => (n ? `${label} · ${n}` : label);

/** Me → Enquiries: Open (to answer), Quoted (waiting on the customer) and Closed. */
export function ArtistEnquiries({ onOpen }: { onOpen: (id: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<ArtistEnquiryScope>('open');
  const enquiries = useArtistEnquiries(scope);
  const summary = useEnquirySummary();
  const items = enquiries.data?.pages.flatMap((p) => p.items) ?? [];
  const options: { key: ArtistEnquiryScope; label: string }[] = [
    { key: 'open', label: withCount('Open', summary.data?.open) },
    { key: 'quoted', label: withCount('Quoted', summary.data?.quoted) },
    { key: 'closed', label: 'Closed' },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
      <BackHeader title="Enquiries" />
      <View style={{ marginTop: 12 }}>
        <Segmented options={options} value={scope} onChange={setScope} />
      </View>
      {enquiries.isPending ? <LoadingView label="Loading enquiries" /> : null}
      {enquiries.isError && !enquiries.data ? <ErrorView error={enquiries.error} onRetry={() => { void enquiries.refetch(); }} /> : null}
      {enquiries.isSuccess && !items.length ? <View style={{ marginTop: 12 }}><EmptyView message={EMPTY[scope]} /></View> : null}
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingVertical: 12, gap: 10, paddingBottom: insets.bottom + theme.spacing.xl }}
        onEndReached={() => { if (enquiries.hasNextPage && !enquiries.isFetchingNextPage) void enquiries.fetchNextPage(); }}
        renderItem={({ item }) => <EnquiryRow enquiry={item} title={customerShortName(item.customer)} pill={ARTIST_ENQUIRY_PILL[item.status]} onPress={() => onOpen(item.id)} />}
      />
    </View>
  );
}
