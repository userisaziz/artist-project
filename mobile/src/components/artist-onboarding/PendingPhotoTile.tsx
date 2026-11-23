import { StyleSheet, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { BrushLoader } from '../common/BrushLoader';
import { Icon } from '../common/Icon';
import { Photo } from '../common/Photo';
import { useTheme } from '../../core/theme/theme-provider';
import type { PendingPhoto } from '../../hooks/artist-onboarding/portfolio-editor';

interface PendingPhotoTileProps {
  item: PendingPhoto;
  onRetry: (localId: string) => void;
  onDiscard: (localId: string) => void;
}

// The picked photo shows through, dimmed, so the artist can tell which one is uploading or failed.
const DIMMED = 0.45;

/** A picked photo that isn't in the portfolio yet: the brush loader while it uploads, Retry / discard when it failed. */
export function PendingPhotoTile({ item, onRetry, onDiscard }: PendingPhotoTileProps) {
  const theme = useTheme();
  const failed = item.state === 'failed';
  return (
    <View
      accessible={!failed}
      accessibilityLabel={failed ? undefined : 'Uploading photo'}
      style={{ aspectRatio: 1, borderRadius: theme.radii.lg, overflow: 'hidden', backgroundColor: theme.colors.imageFallback }}
    >
      <View style={{ flex: 1, opacity: DIMMED }}>
        <Photo uri={item.image.uri} style={{ width: '100%', height: '100%' }} />
      </View>
      {failed ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: theme.spacing[1.5], backgroundColor: theme.colors.overlay }]}>
          <PressableFeedback
            accessibilityRole="button"
            accessibilityLabel={`Retry upload. ${item.error ?? 'Upload failed'}`}
            onPress={() => onRetry(item.localId)}
            style={{ paddingHorizontal: theme.spacing[3], paddingVertical: theme.spacing[1.5], borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface }}
          >
            <AppText variant="label" style={{ color: theme.colors.brand }}>Retry</AppText>
          </PressableFeedback>
          <AppText variant="caption" style={{ color: theme.colors.textOnBrand }}>Upload failed</AppText>
          <PressableFeedback
            accessibilityRole="button"
            accessibilityLabel="Discard this photo"
            onPress={() => onDiscard(item.localId)}
            hitSlop={theme.spacing.sm}
            style={{ position: 'absolute', top: theme.spacing[1.5], right: theme.spacing[1.5] }}
          >
            <Icon name="close" size={16} color={theme.colors.textOnBrand} />
          </PressableFeedback>
        </View>
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <BrushLoader />
        </View>
      )}
    </View>
  );
}
