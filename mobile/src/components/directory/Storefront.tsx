import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SaveToggle } from '../common/SaveButton';
import { BackHeader } from '../common/BackHeader';
import { ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { useArtistPublic, useCachedArtistCard } from '../../hooks/directory/directory';
import { StorefrontReviews } from '../reviews/StorefrontReviews';
import { mostBookedId, packageCountLabel } from '../../utils/directory/storefront';
import type { ArtistPublic, PublicService } from '../../types/directory/directory';
import { PackagePickerSheet } from './PackagePickerSheet';
import { StorefrontAbout } from './StorefrontAbout';
import { StorefrontActions, type FollowControl } from './StorefrontActions';
import { StorefrontChips } from './StorefrontChips';
import { StorefrontFooter } from './StorefrontFooter';
import { StorefrontHero } from './StorefrontHero';
import { StorefrontSection } from './StorefrontSection';
import { StorefrontServiceRow } from './StorefrontServiceRow';
import { StorefrontStats } from './StorefrontStats';
import { StorefrontTabs, type StorefrontTab } from './StorefrontTabs';
import { StorefrontWork } from './StorefrontWork';

/** What a customer can do from the page. The artist's own preview passes none: no booking, no following, no posts
 *  (the feed is customer-only). Follow and posts come from the feed feature, composed in by the route. */
export interface StorefrontCustomer {
  /** Goes on to Date & time for the chosen package. */
  onBook: (service: PublicService) => void;
  onOpenService: (service: PublicService) => void;
  onSeeAllReviews: () => void;
  /** Opens the chat with this artist; `messaging` while it opens. */
  onMessage: () => void;
  messaging: boolean;
  /** Asks this artist for a custom quote. */
  onRequestQuote: () => void;
  save: SaveToggle;
  /** Absent until the follow state is known. */
  follow?: FollowControl;
  /** "From the studio": the artist's newest posts, or their error; absent while loading or when there are none. */
  posts?: ReactNode;
}

interface StorefrontProps {
  artistId: string;
  customer?: StorefrontCustomer;
}

const FOOTER_SPACE = 120;
const END_SPACE = 40;

function tabsFor(artist: ArtistPublic, hasPosts: boolean): StorefrontTab[] {
  const tabs: (StorefrontTab | null)[] = [
    artist.photos.length ? { key: 'work', label: 'Work' } : null,
    { key: 'services', label: 'Services' },
    hasPosts ? { key: 'posts', label: 'Posts' } : null,
    { key: 'reviews', label: 'Reviews' },
    artist.bio || artist.hours?.length || artist.travel_radius_km ? { key: 'about', label: 'About' } : null,
  ];
  return tabs.filter((t): t is StorefrontTab => t !== null);
}

/** Spec §2 Artist storefront: hero, stats, actions, availability, then Work, Services, Posts, Reviews and About,
 *  with a pinned "Check availability". Booking asks which package first when there are several. */
export function Storefront({ artistId, customer }: StorefrontProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: artist, isPending, isError, error, refetch } = useArtistPublic(artistId);
  const card = useCachedArtistCard(artistId);
  const [picking, setPicking] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<string, number>>>({});

  if (isPending && card) {
    // Opened from a list: the hero is already known, so it shows at once and the rest fills in below it.
    return (
      <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StorefrontHero artist={card} save={customer?.save} />
        <LoadingView />
      </ScrollView>
    );
  }

  if (isPending || isError) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
        <BackHeader />
        {isError ? <ErrorView error={error} onRetry={() => { void refetch(); }} /> : <LoadingView label="Loading the artist" shape="detail" />}
      </View>
    );
  }

  const services = artist.services;
  const topId = mostBookedId(services);
  const measure = (key: string, y: number) => { offsets.current[key] = y; };
  const jumpTo = (key: string) => scroll.current?.scrollTo({ y: Math.max(0, (offsets.current[key] ?? 0) - theme.spacing.md), animated: true });
  const book = () => {
    if (!customer || !services.length) return;
    if (services.length === 1) customer.onBook(services[0]);
    else setPicking(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: (customer ? FOOTER_SPACE : END_SPACE) + insets.bottom }}>
        <StorefrontHero artist={artist} save={customer?.save} />
        <StorefrontStats artist={artist} />
        {customer ? (
          <StorefrontActions
            businessName={artist.business_name}
            onBook={book}
            onMessage={customer.onMessage}
            messaging={customer.messaging}
            onEnquire={customer.onRequestQuote}
            follow={customer.follow}
          />
        ) : null}
        <StorefrontChips artist={artist} />
        <StorefrontTabs tabs={tabsFor(artist, !!customer?.posts)} onSelect={jumpTo} />

        {artist.photos.length ? (
          <StorefrontSection title="Work" sectionKey="work" onMeasure={measure}>
            <StorefrontWork photos={artist.photos} />
          </StorefrontSection>
        ) : null}

        <StorefrontSection title="Services" aside={packageCountLabel(services.length)} sectionKey="services" onMeasure={measure}>
          <View style={{ gap: 10 }}>
            {services.map((s) => (
              <StorefrontServiceRow key={s.id} service={s} mostBooked={s.id === topId} onOpen={customer ? () => customer.onOpenService(s) : undefined} />
            ))}
          </View>
        </StorefrontSection>

        {customer?.posts ? (
          <StorefrontSection title="From the studio" sectionKey="posts" onMeasure={measure}>
            {customer.posts}
          </StorefrontSection>
        ) : null}

        <View onLayout={(event) => measure('reviews', event.nativeEvent.layout.y)} style={{ paddingHorizontal: theme.spacing.md }}>
          <StorefrontReviews artistId={artist.id} businessName={artist.business_name} onSeeAll={customer?.onSeeAllReviews} />
        </View>

        {artist.bio || artist.hours?.length || artist.travel_radius_km ? (
          <StorefrontSection title="About" sectionKey="about" onMeasure={measure}>
            <StorefrontAbout artist={artist} />
          </StorefrontSection>
        ) : null}
      </ScrollView>

      {customer ? (
        <>
          <StorefrontFooter packageCount={services.length} fromPaise={artist.from_price_paise} onCheckAvailability={book} />
          <PackagePickerSheet
            visible={picking}
            services={services}
            onPick={(s) => { setPicking(false); customer.onBook(s); }}
            onClose={() => setPicking(false)}
          />
        </>
      ) : null}
    </View>
  );
}
