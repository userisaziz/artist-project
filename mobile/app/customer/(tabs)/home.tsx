import { FlatList, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../../src/components/common/AppText';
import { ErrorView, LoadingView, EmptyView } from '../../../src/components/common/StateViews';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useAuth } from '../../../src/context/auth/auth-provider';
import { useCategories } from '../../../src/hooks/artist-onboarding/artist-onboarding';
import { useArtistList } from '../../../src/hooks/directory/directory';
import { ArtistCardView } from '../../../src/components/directory/ArtistCardView';
import { formatLongDay, greeting, istDateKey } from '../../../src/utils/common/time';
import { useNow } from '../../../src/hooks/common/use-now';

const HERO_SLIDES = [
  { eyebrow: 'WEDDING SEASON', title: 'Bridal artists, ', accent: 'verified', image: 'https://picsum.photos/seed/atelier-hero-bridal/900/600' },
  { eyebrow: 'AT YOUR DOOR', title: 'Mehendi and makeup, ', accent: 'at home', image: 'https://picsum.photos/seed/atelier-hero-home/900/600' },
];
const NEW_COUNT = 3;

// Spec §2 Home: greeting, a 2-slide hero, search, categories, "Discover artists" and "New on Atelier".
export default function CustomerHome() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const now = useNow();
  const categories = useCategories();
  const artists = useArtistList();
  const items = artists.data?.pages.flatMap((p) => p.items) ?? [];
  const openArtist = (id: string) => router.push({ pathname: '/customer/artist/[id]', params: { id } });
  const heading = { fontSize: 22, lineHeight: 28, color: theme.colors.heading } as const;
  const slideWidth = width - theme.spacing.md * 2;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.xl }}>
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{formatLongDay(istDateKey(now))}</AppText>
        <AppText variant="display" style={{ fontSize: 28, lineHeight: 32, color: theme.colors.heading }}>
          {`${greeting(now)}, `}<Accent>{user?.first_name || 'there'}</Accent>
        </AppText>
      </View>

      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }} contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: theme.spacing.md }} snapToInterval={slideWidth + theme.spacing.md} decelerationRate="fast">
        {HERO_SLIDES.map((s) => (
          <View key={s.eyebrow} style={{ width: slideWidth, height: 170, borderRadius: theme.radii.card, overflow: 'hidden', backgroundColor: theme.colors.photoScrim }}>
            <Image source={{ uri: s.image }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.55 }} contentFit="cover" />
            <View style={{ flex: 1, justifyContent: 'flex-end', padding: 18 }}>
              <AppText variant="eyebrow" style={{ color: theme.colors.textOnBrand, opacity: 0.85 }}>{s.eyebrow}</AppText>
              <AppText variant="display" style={{ fontSize: 24, lineHeight: 28, color: theme.colors.textOnBrand, marginTop: 4 }}>
                {s.title}<Accent color={theme.colors.textOnBrand}>{s.accent}</Accent>
              </AppText>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Search artists and services"
          onPress={() => router.navigate('/customer/explore')}
          style={{ marginTop: 16, height: 48, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 }}
        >
          <AppText style={{ color: theme.colors.brand, fontSize: 18 }}>⌕</AppText>
          <AppText variant="body" style={{ color: theme.colors.textMuted }}>Search artists or services</AppText>
        </Pressable>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14, marginTop: 20 }}>
          {(categories.data ?? []).map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`${c.name} artists`}
              onPress={() => router.navigate({ pathname: '/customer/explore', params: { categoryId: String(c.id) } })}
              style={{ width: '31%', alignItems: 'center', gap: 6 }}
            >
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <AppText variant="display" style={{ fontSize: 22, lineHeight: 26, color: theme.colors.brand }}>{c.name.slice(0, 1)}</AppText>
              </View>
              <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{c.name}</AppText>
            </Pressable>
          ))}
        </View>

        <AppText variant="title" style={[heading, { marginTop: 26 }]}>Discover artists</AppText>
      </View>

      {artists.isPending ? <LoadingView /> : null}
      {artists.isError ? <View style={{ paddingHorizontal: theme.spacing.md }}><ErrorView error={artists.error} onRetry={() => { void artists.refetch(); }} /></View> : null}
      {artists.isSuccess && !items.length ? <View style={{ paddingHorizontal: theme.spacing.md, marginTop: 10 }}><EmptyView message="No artists yet. Check back soon." /></View> : null}
      {items.length ? (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(a) => a.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 12, paddingTop: 10 }}
          renderItem={({ item }) => <ArtistCardView artist={item} variant="tile" onPress={() => openArtist(item.id)} />}
        />
      ) : null}

      {items.length ? (
        <View style={{ paddingHorizontal: theme.spacing.md, gap: 12 }}>
          <AppText variant="title" style={[heading, { marginTop: 26 }]}>New on <Accent>Atelier</Accent></AppText>
          {items.slice(0, NEW_COUNT).map((a) => <ArtistCardView key={a.id} artist={a} onPress={() => openArtist(a.id)} />)}
        </View>
      ) : null}
    </ScrollView>
  );
}
