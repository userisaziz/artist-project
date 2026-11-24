import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../../src/components/common/FormScreen';
import { AppButton } from '../../../src/components/common/AppButton';
import { ErrorView, LoadingView } from '../../../src/components/common/StateViews';
import { PortfolioEditorView } from '../../../src/components/artist-onboarding/PortfolioEditorView';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useArtistProfile } from '../../../src/hooks/artist-onboarding/artist-onboarding';
import { usePortfolioEditor } from '../../../src/hooks/artist-onboarding/portfolio-editor';
import type { PortfolioPhoto } from '../../../src/types/artist-onboarding/artist-onboarding';

const NO_PHOTOS: PortfolioPhoto[] = [];

// Atelier hi-fi "onbPortfolio" (step 3 of 4), optional: the artist can add photos now or later from Me → Portfolio.
// Continue (or Skip for now) opens Identity.
export default function PortfolioStep() {
  const theme = useTheme();
  const router = useRouter();
  const profile = useArtistProfile();
  const photos = profile.data?.photos ?? NO_PHOTOS;
  const editor = usePortfolioEditor(photos);
  const ready = !!profile.data;

  return (
    <FormScreen
      onBack={() => router.dismissTo('/artist/onboarding/location')}
      step={3}
      steps={4}
      footer={(
        <AppButton
          label={photos.length ? 'Continue' : 'Skip for now'}
          variant={photos.length ? 'primary' : 'secondary'}
          onPress={() => router.push('/artist/onboarding/identity')}
          disabled={!ready || editor.uploading}
        />
      )}
    >
      <FormHeading eyebrow="STEP 3 · PORTFOLIO" title="Show your" accent="best work" subtitle="Optional: add photos of your work now, or later from Me. Your first photo becomes your cover." />
      <View style={{ marginTop: theme.spacing[4.5] }}>
        {profile.isError && !ready ? (
          <ErrorView error={profile.error} onRetry={() => { void profile.refetch(); }} />
        ) : !ready ? (
          <LoadingView label="Loading your portfolio" />
        ) : (
          <PortfolioEditorView photos={photos} editor={editor} />
        )}
      </View>
    </FormScreen>
  );
}
