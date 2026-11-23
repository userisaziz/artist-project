import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Photo } from '../common/Photo';
import { useTheme } from '../../core/theme/theme-provider';
import type { PortfolioPhoto } from '../../types/artist-onboarding/artist-onboarding';

interface PortfolioPhotoTileProps {
  photo: PortfolioPhoto;
  /** 1-based, as read aloud. */
  position: number;
  cover: boolean;
  onOpen: (photo: PortfolioPhoto) => void;
}

/** One square of the artist's portfolio. A tap (or long-press, the old gesture) opens its actions. */
export function PortfolioPhotoTile({ photo, position, cover, onOpen }: PortfolioPhotoTileProps) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={cover ? `Portfolio photo ${position}, cover` : `Portfolio photo ${position}`}
      accessibilityHint="Opens make cover and remove"
      onPress={() => onOpen(photo)}
      onLongPress={() => onOpen(photo)}
      style={{ aspectRatio: 1, borderRadius: theme.radii.lg, overflow: 'hidden' }}
    >
      <Photo uri={photo.thumb_url} style={{ width: '100%', height: '100%' }} />
      {cover ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: theme.spacing.sm, top: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing[0.75], borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface }}>
          <AppText variant="eyebrow" style={{ letterSpacing: 0, color: theme.colors.brand }}>Cover</AppText>
        </View>
      ) : null}
    </PressableFeedback>
  );
}
