import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../../src/components/FormScreen';
import { AppText } from '../../../src/components/AppText';
import { AppButton } from '../../../src/components/AppButton';
import { AddServiceSheet } from '../../../src/artist/AddServiceSheet';
import { useTheme } from '../../../src/theme/theme-provider';
import { useArtistProfile, useArtistWrite } from '../../../src/artist/queries';
import { formatDuration, formatPrice } from '../../../src/artist/format';
import * as artistApi from '../../../src/api/endpoints/artist';
import { errorMessage } from '../../../src/api/error-message';

// Step 2 of 3 (not drawn in the design; follows the Profile step): the artist's service menu.
export default function ServicesStep() {
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useArtistProfile();
  const write = useArtistWrite();
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const services = profile?.services ?? [];
  const categoryName = (id: number) => profile?.categories.find((c) => c.id === id)?.name ?? '';

  const remove = async (id: string) => {
    setError(null);
    try { await write(() => artistApi.deleteService(id)); } catch (e) { setError(errorMessage(e)); }
  };

  return (
    <FormScreen
      onBack={() => router.dismissTo('/artist/onboarding/profile')}
      step={2}
      steps={3}
      footer={<AppButton label="Continue" onPress={() => { if (services.length) router.push('/artist/onboarding/portfolio'); }} disabled={!services.length} />}
    >
      <FormHeading eyebrow="STEP 2 · SERVICES" title="Set your" accent="prices" subtitle="Add what clients can book. You need at least one service." />
      <View style={{ gap: 10, marginTop: 20 }}>
        {services.map((s) => (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radii.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator }}>
            <View style={{ flex: 1 }}>
              <AppText variant="label" style={{ fontSize: 15, color: theme.colors.textPrimary }}>{s.name}</AppText>
              <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 2 }}>
                {`${categoryName(s.category_id)} · ${formatPrice(s.price_paise)} · ${formatDuration(s.duration_minutes)}`}
              </AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${s.name}`} onPress={() => { void remove(s.id); }} hitSlop={8}>
              <AppText style={{ fontSize: 18, color: theme.colors.textMuted }}>✕</AppText>
            </Pressable>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => setSheet(true)}
          style={{ height: 52, borderRadius: theme.radii.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.border, backgroundColor: theme.colors.washTop, alignItems: 'center', justifyContent: 'center' }}
        >
          <AppText variant="label" style={{ color: theme.colors.brand }}>+ Add service</AppText>
        </Pressable>
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
      <AddServiceSheet
        visible={sheet}
        categories={profile?.categories ?? []}
        onClose={() => setSheet(false)}
        onSubmit={async (service) => { await write(() => artistApi.addService(service)); }}
      />
    </FormScreen>
  );
}
