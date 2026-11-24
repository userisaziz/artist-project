import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '../../src/components/common/BackHeader';
import { ErrorView, LoadingView } from '../../src/components/common/StateViews';
import { PortfolioEditorView } from '../../src/components/artist-onboarding/PortfolioEditorView';
import { useTheme } from '../../src/core/theme/theme-provider';
import { useArtistProfile } from '../../src/hooks/artist-onboarding/artist-onboarding';
import { usePortfolioEditor } from '../../src/hooks/artist-onboarding/portfolio-editor';
import type { PortfolioPhoto } from '../../src/types/artist-onboarding/artist-onboarding';

const NO_PHOTOS: PortfolioPhoto[] = [];

// Me → Portfolio: an approved artist adds, removes and reorders their work photos; changes go live at once.
export default function MyPortfolio() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useArtistProfile();
  const photos = profile.data?.photos ?? NO_PHOTOS;
  const editor = usePortfolioEditor(photos);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl, gap: 14 }}>
        <BackHeader title="Portfolio" />
        {profile.isError && !profile.data ? (
          <ErrorView error={profile.error} onRetry={() => { void profile.refetch(); }} />
        ) : !profile.data ? (
          <LoadingView label="Loading your portfolio" />
        ) : (
          <View>
            <PortfolioEditorView photos={photos} editor={editor} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
