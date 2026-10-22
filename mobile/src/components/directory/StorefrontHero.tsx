import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Accent, AppText } from '../common/AppText';
import { Avatar } from '../common/Avatar';
import { BackHeader } from '../common/BackHeader';
import { Icon } from '../common/Icon';
import { Photo } from '../common/Photo';
import { PhotoScrim } from '../common/PhotoScrim';
import { SaveButton, type SaveToggle } from '../common/SaveButton';
import { useTheme } from '../../core/theme/theme-provider';
import { categoryLine } from './ArtistCardView';
import { splitName } from '../../utils/directory/storefront';
import type { ArtistPublic } from '../../types/directory/directory';

interface StorefrontHeroProps {
  artist: ArtistPublic;
  /** Saving the artist (customers); the artist's own preview leaves it out. */
  save?: SaveToggle;
}

const HERO_HEIGHT = 440;
const SCRIM_HEIGHT = 230;
const AVATAR = 44;
const AVATAR_RING = 2;
const SAVE_BUTTON = 40;
// The stats card overlaps the hero's bottom edge, so the name block sits above that overlap.
export const STATS_OVERLAP = 34;
const NAME_BOTTOM = STATS_OVERLAP + 24;

/** Spec §2 storefront hero: the signature photo full-bleed, with the avatar, "Verified artist", name and line over it. */
export function StorefrontHero({ artist, save }: StorefrontHeroProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [first, rest] = splitName(artist.business_name);
  const onPhoto = theme.colors.textOnBrand;
  return (
    <View style={{ height: HERO_HEIGHT, backgroundColor: theme.colors.imageFallback }}>
      {artist.cover_url ? <Photo uri={artist.cover_url} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
      <PhotoScrim height={SCRIM_HEIGHT} />
      <View style={{ position: 'absolute', top: insets.top + theme.spacing.sm, left: theme.spacing.md, right: theme.spacing.md, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <BackHeader />
        </View>
        {save ? (
          <View style={{ width: SAVE_BUTTON, height: SAVE_BUTTON, borderRadius: SAVE_BUTTON / 2, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <SaveButton name={artist.business_name} saved={save.isSaved(artist.id)} onPress={() => save.toggle(artist.id)} />
          </View>
        ) : null}
      </View>
      <View style={{ position: 'absolute', left: theme.spacing.md + theme.spacing.xs, right: theme.spacing.md + theme.spacing.xs, bottom: NAME_BOTTOM }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View style={{ borderRadius: (AVATAR + AVATAR_RING * 2) / 2, borderWidth: AVATAR_RING, borderColor: onPhoto }}>
            <Avatar uri={artist.photo_url} name={artist.business_name} size={AVATAR} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingHorizontal: 10, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface }}>
            <Icon name="verified" size={14} color={theme.colors.brand} />
            <AppText variant="label" style={{ color: theme.colors.brand }}>Verified artist</AppText>
          </View>
        </View>
        <AppText variant="display" accessibilityRole="header" style={{ color: onPhoto, marginTop: 10 }}>
          {rest ? `${first} ` : first}
          {rest ? <Accent color={onPhoto}>{rest}</Accent> : null}
        </AppText>
        <AppText variant="body" style={{ color: onPhoto, marginTop: 6 }}>{categoryLine(artist)}</AppText>
      </View>
    </View>
  );
}
