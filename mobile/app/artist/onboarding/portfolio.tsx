import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../../src/components/common/FormScreen';
import { AppText } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useArtistProfile, useArtistWrite } from '../../../src/hooks/artist-onboarding/artist-onboarding';
import { pickImages, uploadImage } from '../../../src/api/artist-onboarding/upload';
import * as artistApi from '../../../src/api/artist-onboarding/artist-onboarding';
import { errorMessage } from '../../../src/core/api/error-message';

const MIN_PHOTOS = 6;  // backend artist_service.MIN_PHOTOS
const MAX_PHOTOS = 30; // backend artist_service.MAX_PHOTOS

interface Uploading { localId: string; uri: string }

// Atelier hi-fi "onbPortfolio" (step 3 of 4): the first photo is the cover; long-press a tile for Make cover / Remove. Continue opens Identity.
export default function PortfolioStep() {
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useArtistProfile();
  const write = useArtistWrite();
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photos = profile?.photos ?? [];
  const count = photos.length;

  const add = async () => {
    setError(null);
    try {
      const picked = await pickImages(MAX_PHOTOS - count - uploading.length);
      const queued = picked.map((p, i) => ({ ...p, localId: `${Date.now()}-${i}` }));
      setUploading((u) => [...u, ...queued.map(({ localId, uri }) => ({ localId, uri }))]);
      // One at a time, so the portfolio keeps the order they were picked in.
      for (const image of queued) {
        try {
          const uploaded = await uploadImage(image, 'portfolio');
          await write(() => artistApi.addPhoto(uploaded));
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setUploading((u) => u.filter((x) => x.localId !== image.localId));
        }
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await fn(); setSelected(null); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const makeCover = (id: string) => run(() => write(() => artistApi.reorderPhotos([id, ...photos.filter((p) => p.id !== id).map((p) => p.id)])));
  const remove = (id: string) => run(() => write(() => artistApi.deletePhoto(id)));

  const tile = { width: '31.5%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: theme.colors.imageFallback } as const;
  const enough = count >= MIN_PHOTOS;
  return (
    <FormScreen
      onBack={() => router.dismissTo('/artist/onboarding/services')}
      step={3}
      steps={4}
      footer={(
        <AppButton
          label={enough ? 'Continue' : `Continue · ${count} of ${MIN_PHOTOS} photos`}
          onPress={() => { if (enough && uploading.length === 0) router.push('/artist/onboarding/identity'); }}
          disabled={!enough || uploading.length > 0}
        />
      )}
    >
      <FormHeading eyebrow="STEP 3 · PORTFOLIO" title="Show your" accent="best work" subtitle={`Add at least ${MIN_PHOTOS} photos. Your first photo becomes your cover.`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
        {photos.map((p, i) => (
          <Pressable
            key={p.id}
            accessibilityLabel={`Portfolio photo ${i + 1}`}
            accessibilityState={{ selected: selected === p.id }}
            onLongPress={() => setSelected(p.id)}
            onPress={() => setSelected(null)}
            style={[tile, selected === p.id ? { borderWidth: 3, borderColor: theme.colors.brand } : null]}
          >
            <Image source={{ uri: p.thumb_url }} contentFit="cover" style={{ flex: 1 }} />
            {i === 0 ? (
              <View pointerEvents="none" style={{ position: 'absolute', left: 8, top: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface }}>
                <AppText variant="eyebrow" style={{ fontSize: 10.5, letterSpacing: 0, color: theme.colors.brand }}>Cover</AppText>
              </View>
            ) : null}
          </Pressable>
        ))}
        {uploading.map((u) => (
          <View key={u.localId} style={tile} accessibilityLabel="Uploading photo">
            <Image source={{ uri: u.uri }} contentFit="cover" style={{ flex: 1, opacity: 0.5 }} />
            <ActivityIndicator color={theme.colors.brand} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
          </View>
        ))}
        {count + uploading.length < MAX_PHOTOS ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add photos"
            onPress={() => { void add(); }}
            style={[tile, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.border, backgroundColor: theme.colors.washTop, alignItems: 'center', justifyContent: 'center', gap: 4 }]}
          >
            <AppText style={{ fontSize: 22, color: theme.colors.brand }}>+</AppText>
            <AppText variant="label" style={{ fontSize: 12, color: theme.colors.brand }}>Add</AppText>
          </Pressable>
        ) : null}
      </View>

      {selected ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {photos[0]?.id !== selected ? (
            <View style={{ flex: 1 }}><AppButton label="Make cover" variant="secondary" onPress={() => { void makeCover(selected); }} disabled={busy} /></View>
          ) : null}
          <View style={{ flex: 1 }}><AppButton label="Remove" variant="ghost" onPress={() => { void remove(selected); }} disabled={busy} /></View>
        </View>
      ) : (
        <View style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: theme.colors.washTop }}>
          <AppText variant="caption" style={{ color: theme.colors.textSecondary, lineHeight: 19 }}>
            <AppText variant="caption" style={{ color: theme.colors.brand, fontFamily: theme.typography.label.fontFamily }}>✦ Tip: </AppText>
            Daylight photos of finished work get more bookings than studio shots. Long-press a photo to make it your cover or remove it.
          </AppText>
        </View>
      )}
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
    </FormScreen>
  );
}
