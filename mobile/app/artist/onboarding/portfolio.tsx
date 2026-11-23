import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../../src/components/common/FormScreen';
import { AppText } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { PhotoGrid } from '../../../src/components/common/PhotoGrid';
import { ErrorView, LoadingView } from '../../../src/components/common/StateViews';
import { PortfolioPhotoTile } from '../../../src/components/artist-onboarding/PortfolioPhotoTile';
import { PendingPhotoTile } from '../../../src/components/artist-onboarding/PendingPhotoTile';
import { AddPhotoTile } from '../../../src/components/artist-onboarding/AddPhotoTile';
import { PhotoActionsSheet } from '../../../src/components/artist-onboarding/PhotoActionsSheet';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useArtistProfile } from '../../../src/hooks/artist-onboarding/artist-onboarding';
import { usePortfolioEditor } from '../../../src/hooks/artist-onboarding/portfolio-editor';
import { MIN_PHOTOS } from '../../../src/utils/artist-onboarding/routing';
import type { PortfolioPhoto } from '../../../src/types/artist-onboarding/artist-onboarding';

const NO_PHOTOS: PortfolioPhoto[] = [];

// Atelier hi-fi "onbPortfolio" (step 4 of 5): the first photo is the cover; tap a photo for Make cover / Remove.
// Continue opens Identity.
export default function PortfolioStep() {
  const theme = useTheme();
  const router = useRouter();
  const profile = useArtistProfile();
  const photos = profile.data?.photos ?? NO_PHOTOS;
  const editor = usePortfolioEditor(photos);
  const [open, setOpen] = useState<PortfolioPhoto | null>(null);
  const count = photos.length;
  const enough = count >= MIN_PHOTOS;
  const ready = !!profile.data;

  // The sheet closes whether the write landed or not: a failure's message is on the page, which the sheet
  // would otherwise cover.
  const act = async (run: (id: string) => Promise<void>) => {
    if (!open) return;
    await run(open.id);
    setOpen(null);
  };

  return (
    <FormScreen
      onBack={() => router.dismissTo('/artist/onboarding/services')}
      step={4}
      steps={5}
      footer={(
        <AppButton
          label={enough ? 'Continue' : `Continue · ${count} of ${MIN_PHOTOS} photos`}
          onPress={() => router.push('/artist/onboarding/identity')}
          disabled={!ready || !enough || editor.uploading}
        />
      )}
    >
      <FormHeading eyebrow="STEP 4 · PORTFOLIO" title="Show your" accent="best work" subtitle={`Add at least ${MIN_PHOTOS} photos. Your first photo becomes your cover.`} />
      <View style={{ marginTop: theme.spacing[4.5] }}>
        {profile.isError && !ready ? (
          <ErrorView error={profile.error} onRetry={() => { void profile.refetch(); }} />
        ) : !ready ? (
          <LoadingView label="Loading your portfolio" />
        ) : (
          <PhotoGrid>
            {photos.map((p, i) => <PortfolioPhotoTile key={p.id} photo={p} position={i + 1} cover={i === 0} onOpen={setOpen} />)}
            {editor.pending.map((item) => (
              <PendingPhotoTile key={item.localId} item={item} onRetry={(id) => { void editor.retry(id); }} onDiscard={editor.discard} />
            ))}
            {editor.canAdd ? <AddPhotoTile onPress={() => { void editor.add(); }} /> : null}
          </PhotoGrid>
        )}
      </View>

      <View style={{ marginTop: theme.spacing.md, padding: theme.spacing[3.5], borderRadius: theme.radii.menu, backgroundColor: theme.colors.washTop }}>
        <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>
          <AppText variant="caption" style={{ color: theme.colors.brand, fontFamily: theme.typography.label.fontFamily }}>Tip: </AppText>
          Daylight photos of finished work get more bookings than studio shots. Tap a photo to make it your cover or remove it.
        </AppText>
      </View>
      {editor.error ? (
        <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{editor.error}</AppText>
      ) : null}

      {open ? (
        <PhotoActionsSheet
          key={open.id}
          photo={open}
          cover={photos[0]?.id === open.id}
          busy={editor.busy}
          onMakeCover={() => { void act(editor.makeCover); }}
          onRemove={() => { void act(editor.remove); }}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </FormScreen>
  );
}
