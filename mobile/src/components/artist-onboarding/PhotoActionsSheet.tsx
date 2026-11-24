import { useState } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '../common/BottomSheet';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { Photo } from '../common/Photo';
import { useTheme } from '../../core/theme/theme-provider';
import type { PortfolioPhoto } from '../../types/artist-onboarding/artist-onboarding';

interface PhotoActionsSheetProps {
  photo: PortfolioPhoto;
  cover: boolean;
  busy: boolean;
  onMakeCover: () => void;
  onRemove: () => void;
  onClose: () => void;
}

const PREVIEW_RATIO = 4 / 3;

/**
 * What the artist can do with one portfolio photo: make it the cover, or remove it. Remove asks once in
 * place (Keep / Remove) because it deletes the file for good. Mount it with `key={photo.id}` so the
 * confirm step never carries over to the next photo.
 */
export function PhotoActionsSheet({ photo, cover, busy, onMakeCover, onRemove, onClose }: PhotoActionsSheetProps) {
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);
  return (
    <BottomSheet visible title={confirming ? 'Remove this photo?' : 'Portfolio photo'} onClose={onClose}>
      <View style={{ aspectRatio: PREVIEW_RATIO, borderRadius: theme.radii.card, overflow: 'hidden' }}>
        <Photo uri={photo.card_url} style={{ width: '100%', height: '100%' }} />
      </View>
      {confirming ? (
        <>
          <AppText variant="body" style={{ color: theme.colors.textSecondary }}>
            It’s deleted from your portfolio for good. You can always add it again later.
          </AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}><AppButton label="Keep" variant="secondary" onPress={() => setConfirming(false)} disabled={busy} /></View>
            <View style={{ flex: 1 }}><AppButton label="Remove" accessibilityLabel="Remove photo" onPress={onRemove} loading={busy} /></View>
          </View>
        </>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {cover ? (
            <AppText variant="caption" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>This is your cover photo.</AppText>
          ) : (
            <AppButton label="Make cover" onPress={onMakeCover} loading={busy} />
          )}
          <AppButton label="Remove photo" variant="outline" onPress={() => setConfirming(true)} disabled={busy} />
        </View>
      )}
    </BottomSheet>
  );
}
