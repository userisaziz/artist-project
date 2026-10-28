import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { Photo } from '../common/Photo';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { pickImages, uploadImage } from '../../api/artist-onboarding/upload';

/** The package photo being edited: `url` to show; `key` only once it changes (a new upload's key, or null to remove). */
export interface ServicePhotoDraft {
  url: string | null;
  key?: string | null;
}

interface ServicePhotoFieldProps {
  value: ServicePhotoDraft;
  onChange: (value: ServicePhotoDraft) => void;
}

const TILE = 96;

/** "Add a package photo": picks one image, uploads it as a "service" photo, and shows it with Change and Remove. */
export function ServicePhotoField({ value, onChange }: ServicePhotoFieldProps) {
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    const [image] = await pickImages(1);
    if (!image) return; // the artist closed the picker
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadImage(image, 'service');
      onChange({ url: image.uri, key: uploaded.key });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="label" style={{ color: theme.colors.textSecondary }}>Package photo (optional)</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {value.url ? (
          <Photo uri={value.url} label="Package photo" style={{ width: TILE, height: TILE, borderRadius: theme.radii.md }} />
        ) : (
          <PressableFeedback
            accessibilityRole="button"
            accessibilityLabel="Add a package photo"
            accessibilityState={{ busy: uploading }}
            disabled={uploading}
            onPress={() => { void pick(); }}
            style={{ width: TILE, height: TILE, borderRadius: theme.radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.canvas }}
          >
            {uploading ? <ActivityIndicator color={theme.colors.brand} /> : <Icon name="plus" size={22} color={theme.colors.brand} />}
          </PressableFeedback>
        )}
        {value.url ? (
          <View style={{ gap: theme.spacing.sm }}>
            <PressableFeedback accessibilityRole="button" accessibilityLabel="Change package photo" disabled={uploading} onPress={() => { void pick(); }} hitSlop={6}>
              <AppText variant="label" style={{ color: theme.colors.brand }}>{uploading ? 'Uploading…' : 'Change'}</AppText>
            </PressableFeedback>
            <PressableFeedback accessibilityRole="button" accessibilityLabel="Remove package photo" disabled={uploading} onPress={() => onChange({ url: null, key: null })} hitSlop={6}>
              <AppText variant="label" style={{ color: theme.colors.error }}>Remove</AppText>
            </PressableFeedback>
          </View>
        ) : (
          <AppText variant="caption" style={{ flex: 1, color: theme.colors.textMuted }}>Customers see it next to this package on your page.</AppText>
        )}
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
    </View>
  );
}
