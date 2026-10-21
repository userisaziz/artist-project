import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { Avatar } from '../../../src/components/common/Avatar';
import { Card } from '../../../src/components/common/Card';
import { MenuRow } from '../../../src/components/common/MenuRow';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useAuth } from '../../../src/context/auth/auth-provider';
import { useArtistProfile } from '../../../src/hooks/artist-onboarding/artist-onboarding';
import { errorMessage } from '../../../src/core/api/error-message';
import { useMyReviews } from '../../../src/hooks/reviews/reviews';
import { formatAverage } from '../../../src/utils/reviews/format';
import type { ReviewSummary } from '../../../src/types/reviews/reviews';
import { Icon } from '../../../src/components/common/Icon';
import { EditProfileRow } from '../../../src/components/artist-onboarding/EditProfileRow';

const COVER_HEIGHT = 170;

/** "4.9 · 128", "New", or "…" while loading. */
function reviewsDetail(summary: ReviewSummary | undefined): string {
  if (!summary) return '…';
  return summary.average === null ? 'New' : `${formatAverage(summary.average)} · ${summary.count}`;
}
const AVATAR = 84;

// Spec §3 Me: avatar, business name and "Verified", the public storefront, Reviews and My services (Increment 6),
// the customer side, Log out.
export default function ArtistMe() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { chooseRole, signOut } = useAuth();
  const { data: profile } = useArtistProfile();
  const reviews = useMyReviews();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = profile?.business_name ?? '';
  const cover = profile?.photos[0]?.card_url;

  const toCustomer = async () => {
    if (switching) return;
    setSwitching(true);
    setError(null);
    try {
      await chooseRole('customer'); // the root gate moves to the customer area
    } catch (e) {
      setError(errorMessage(e));
      setSwitching(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingBottom: theme.spacing.xl }}>
      <View style={{ height: COVER_HEIGHT + insets.top, backgroundColor: theme.colors.imageFallback }}>
        {cover ? <Image source={{ uri: cover }} style={{ flex: 1 }} contentFit="cover" /> : null}
      </View>
      <View style={{ paddingHorizontal: theme.spacing.md, marginTop: -AVATAR / 2 }}>
        <View style={{ width: AVATAR + 6, height: AVATAR + 6, borderRadius: (AVATAR + 6) / 2, padding: 3, backgroundColor: theme.colors.surface, ...theme.shadows.sm }}>
          <Avatar uri={profile?.photo_url} name={name || '?'} size={AVATAR} />
        </View>
        <AppText variant="display" style={{ fontSize: 26, lineHeight: 30, color: theme.colors.heading, marginTop: 8 }}>{name}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="verified" size={16} color={theme.colors.confirmedInk} />
            <AppText variant="label" style={{ color: theme.colors.confirmedInk }}>Verified</AppText>
          </View>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{profile?.city ?? ''}</AppText>
        </View>
        <View style={{ marginTop: 16 }}>
          <AppButton label="View public profile" variant="secondary" onPress={() => router.push('/artist/public-profile')} />
        </View>

        <Card style={{ marginTop: 14, paddingVertical: 0 }}>
          <MenuRow label="Reviews" detail={reviewsDetail(reviews.data?.pages[0]?.summary)} onPress={() => router.push('/artist/reviews')} />
          <View style={{ height: 1, backgroundColor: theme.colors.separator }} />
          <MenuRow label="My shop" onPress={() => router.push('/artist/shop')} />
          <MenuRow label="Posts & articles" detail="+ New post" onPress={() => router.push('/artist/posts')} />
          <MenuRow label="My services" detail={String(profile?.services.length ?? 0)} onPress={() => router.push('/artist/services')} />
          <EditProfileRow />
        </Card>

        <Pressable
          accessibilityRole="button"
          onPress={() => { void toCustomer(); }}
          disabled={switching}
          style={{ marginTop: 14, borderRadius: 18, backgroundColor: theme.colors.brandSoft, padding: 16, flexDirection: 'row', alignItems: 'center', opacity: switching ? 0.6 : 1 }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="subtitle" style={{ fontSize: 14.5, color: theme.colors.textPrimary }}>Switch to customer</AppText>
            <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>Book other artists with the same account</AppText>
          </View>
          <Icon name="arrow-left-right" size={20} color={theme.colors.brand} />
        </Pressable>
        {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: 8 }}>{error}</AppText> : null}

        <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} style={{ marginTop: 24, alignSelf: 'center', padding: 12 }}>
          <AppText variant="button" style={{ color: theme.colors.brand }}>Log out</AppText>
        </Pressable>
      </View>
    </ScrollView>
  );
}
