import { useState } from 'react';
import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Photo } from '../common/Photo';
import { useTheme } from '../../core/theme/theme-provider';
import type { ArtistPublic } from '../../types/directory/directory';

interface StorefrontWorkProps {
  photos: ArtistPublic['photos'];
}

const PREVIEW_COUNT = 6;
const TILE_WIDTH = '32%';
const TILE_RATIO = 3 / 4;

/** The portfolio, three across: the first six, with "See all" on the last tile when there are more. */
export function StorefrontWork({ photos }: StorefrontWorkProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? photos : photos.slice(0, PREVIEW_COUNT);
  const hidden = photos.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 }}>
      {shown.map((p, i) => {
        const last = !expanded && hidden > 0 && i === shown.length - 1;
        return (
          <View key={p.id} style={{ width: TILE_WIDTH, aspectRatio: TILE_RATIO, borderRadius: theme.radii.md, overflow: 'hidden' }}>
            <Photo uri={p.thumb_url} label={`Work photo ${i + 1}`} style={{ width: '100%', height: '100%' }} />
            {last ? (
              <PressableFeedback
                feedback={false}
                accessibilityRole="button"
                accessibilityLabel={`See all ${photos.length} photos`}
                onPress={() => setExpanded(true)}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.overlay }}
              >
                <AppText variant="label" style={{ color: theme.colors.textOnBrand }}>{`See all ${photos.length}`}</AppText>
              </PressableFeedback>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
