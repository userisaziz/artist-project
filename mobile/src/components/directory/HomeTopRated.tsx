import { View } from 'react-native';
import { SectionHeader } from '../common/SectionHeader';
import { MotionEntrance } from '../common/MotionEntrance';
import { ArtistCompactRow } from './ArtistCompactRow';
import { useTheme } from '../../core/theme/theme-provider';
import { useEntranceWindow } from '../../core/motion/motion';
import type { ArtistCard } from '../../types/directory/directory';

interface HomeTopRatedProps {
  artists: ArtistCard[];
  onOpen: (artistId: string) => void;
  onSeeAll: () => void;
}

/** Home's "Top rated" rows; nothing until there is at least one rated artist. */
export function HomeTopRated({ artists, onOpen, onSeeAll }: HomeTopRatedProps) {
  const theme = useTheme();
  const armed = useEntranceWindow(artists.length > 0);
  if (!artists.length) return null;
  return (
    <>
      <SectionHeader title="Top rated" onSeeAll={onSeeAll} seeAllLabel="See all top rated artists" />
      <View accessibilityLabel="Top rated artists" style={{ paddingHorizontal: theme.spacing.md, gap: 10 }}>
        {artists.map((a, i) => (
          <MotionEntrance key={a.id} index={i} armed={armed}>
            <ArtistCompactRow artist={a} onPress={() => onOpen(a.id)} />
          </MotionEntrance>
        ))}
      </View>
    </>
  );
}
