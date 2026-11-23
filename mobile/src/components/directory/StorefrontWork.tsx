import { useState } from 'react';
import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Photo } from '../common/Photo';
import { PhotoGrid } from '../common/PhotoGrid';
import { PhotoViewer } from '../common/PhotoViewer';
import { useTheme } from '../../core/theme/theme-provider';
import type { ArtistPublic } from '../../types/directory/directory';

interface StorefrontWorkProps {
  photos: ArtistPublic['photos'];
}

const PREVIEW_COUNT = 6;
const TILE_RATIO = 3 / 4;

/** The portfolio, three across: the first six, with "See all" on the last tile when there are more. Any photo
 *  opens full screen; an expanded grid folds back with "Show less". */
export function StorefrontWork({ photos }: StorefrontWorkProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const shown = expanded ? photos : photos.slice(0, PREVIEW_COUNT);
  const hidden = photos.length - shown.length;
  return (
    <View style={{ gap: theme.spacing[3] }}>
      <PhotoGrid gap={theme.spacing[1.5]}>
        {shown.map((p, i) => {
          const last = !expanded && hidden > 0 && i === shown.length - 1;
          return (
            <PressableFeedback
              key={p.id}
              feedback={false}
              scale
              accessibilityRole="button"
              accessibilityLabel={last ? `See all ${photos.length} photos` : `Work photo ${i + 1}, open full screen`}
              onPress={() => (last ? setExpanded(true) : setViewing(i))}
              style={{ aspectRatio: TILE_RATIO, borderRadius: theme.radii.md, overflow: 'hidden' }}
            >
              <Photo uri={p.thumb_url} style={{ width: '100%', height: '100%' }} />
              {last ? (
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.overlay }}>
                  <AppText variant="label" style={{ color: theme.colors.textOnBrand }}>{`See all ${photos.length}`}</AppText>
                </View>
              ) : null}
            </PressableFeedback>
          );
        })}
      </PhotoGrid>
      {expanded && photos.length > PREVIEW_COUNT ? (
        <PressableFeedback accessibilityRole="button" onPress={() => setExpanded(false)} style={{ alignSelf: 'center', padding: theme.spacing.sm }}>
          <AppText variant="label" style={{ color: theme.colors.brand }}>Show less</AppText>
        </PressableFeedback>
      ) : null}
      <PhotoViewer photos={photos} startIndex={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}
