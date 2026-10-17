import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../src/core/components/AppText';
import { BackHeader } from '../../src/core/components/BackHeader';
import { StatusPill } from '../../src/core/components/StatusPill';
import { EmptyView, ErrorView, LoadingView } from '../../src/core/components/StateViews';
import { useTheme } from '../../src/core/theme/theme-provider';
import { useArtistProfile } from '../../src/artist/queries';
import { replyToReview, reportReview } from '../../src/api/endpoints/reviews';
import { useMyReviews, useMyReviewWrite } from '../../src/reviews/queries';
import { reviewStatusPill } from '../../src/reviews/format';
import { ReviewCard } from '../../src/reviews/ReviewCard';
import { ReviewSummaryView } from '../../src/reviews/ReviewSummaryView';
import { TextSheet } from '../../src/reviews/TextSheet';
import type { ArtistReview } from '../../src/core/api/types';

const MAX_REPLY = 500;
const MAX_REASON = 500;

/** Which sheet is open, and for which review. */
type SheetTarget = { kind: 'reply' | 'report'; review: ArtistReview };

// Spec §2.2 Reviews: the summary, then every review (pills on non-public ones), each with Reply and Report.
export default function ArtistReviews() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: profile } = useArtistProfile();
  const list = useMyReviews();
  const write = useMyReviewWrite();
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const summary = list.data?.pages[0]?.summary;
  const businessName = profile?.business_name ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm }}>
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <BackHeader title="Reviews" />
      </View>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl, gap: 12 }}
        ListHeaderComponent={summary ? <View style={{ marginBottom: 4 }}><ReviewSummaryView summary={summary} /></View> : null}
        renderItem={({ item }) => (
          <ArtistReviewRow review={item} businessName={businessName} onReply={() => setSheet({ kind: 'reply', review: item })} onReport={() => setSheet({ kind: 'report', review: item })} />
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }}
        ListEmptyComponent={
          list.isPending ? <LoadingView />
            : list.isError ? <ErrorView error={list.error} onRetry={() => { void list.refetch(); }} />
              : <EmptyView message="No reviews yet. Customers can review a booking once it’s completed." />
        }
        ListFooterComponent={list.isFetchingNextPage ? <LoadingView label="Loading more" /> : null}
      />

      {sheet?.kind === 'reply' ? (
        <TextSheet
          key={`reply-${sheet.review.id}`}
          title={`Reply to ${sheet.review.reviewer_name}`}
          label="Your reply"
          submitLabel="Post reply"
          maxLength={MAX_REPLY}
          initial={sheet.review.reply ?? ''}
          allowEmpty={!!sheet.review.reply}
          note={sheet.review.reply ? 'Your reply is public. Clear it and post to remove it.' : 'Your reply is public, below the review.'}
          onClose={() => setSheet(null)}
          onSubmit={async (text) => { await write(() => replyToReview(sheet.review.id, text)); }}
        />
      ) : null}
      {sheet?.kind === 'report' ? (
        <TextSheet
          key={`report-${sheet.review.id}`}
          title="Report this review"
          label="Reason"
          submitLabel="Send report"
          maxLength={MAX_REASON}
          note="A moderator checks it. The review stays up until they decide."
          onClose={() => setSheet(null)}
          onSubmit={async (reason) => { await write(() => reportReview(sheet.review.id, reason)); }}
        />
      ) : null}
    </View>
  );
}

interface ArtistReviewRowProps {
  review: ArtistReview;
  businessName: string;
  onReply: () => void;
  onReport: () => void;
}

function ArtistReviewRow({ review, businessName, onReply, onReport }: ArtistReviewRowProps) {
  const theme = useTheme();
  const pill = reviewStatusPill(review);
  const name = review.reviewer_name;
  return (
    <ReviewCard review={review} businessName={businessName} header={pill ? <StatusPill label={pill.label} tone={pill.tone} /> : null}>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
        <SmallAction
          label={review.reply ? 'Edit reply' : 'Reply'}
          accessibilityLabel={review.reply ? `Edit reply to ${name}` : `Reply to ${name}`}
          onPress={onReply}
        />
        {review.status === 'published' ? <SmallAction label="Report" accessibilityLabel={`Report review by ${name}`} onPress={onReport} muted /> : null}
      </View>
      {review.report_reason ? (
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`You reported it: ${review.report_reason}`}</AppText>
      ) : null}
    </ReviewCard>
  );
}

function SmallAction({ label, accessibilityLabel, onPress, muted = false }: { label: string; accessibilityLabel: string; onPress: () => void; muted?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={{ height: 34, paddingHorizontal: 14, borderRadius: theme.radii.pill, justifyContent: 'center', backgroundColor: muted ? theme.colors.neutralSoft : theme.colors.brandSoft }}
    >
      <AppText variant="label" style={{ fontSize: 13, color: muted ? theme.colors.textSecondary : theme.colors.brand }}>{label}</AppText>
    </Pressable>
  );
}
