import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../../src/components/common/FormScreen';
import { AppText } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { AddServiceSheet } from '../../../src/components/artist-onboarding/AddServiceSheet';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useArtistProfile, useArtistWrite, useCategories } from '../../../src/hooks/artist-onboarding/artist-onboarding';
import { formatDuration, formatPrice } from '../../../src/utils/common/format';
import * as artistApi from '../../../src/api/artist-onboarding/artist-onboarding';
import { errorMessage } from '../../../src/core/api/error-message';
import type { CatalogCategory } from '../../../src/types/catalog/catalog';
import { Icon } from '../../../src/components/common/Icon';

// Step 2 of 4 (not drawn in the design; follows the Profile step): the artist's service menu.
export default function ServicesStep() {
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useArtistProfile();
  const write = useArtistWrite();
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: catalog = [] } = useCategories();
  const services = profile?.services ?? [];
  const mine: CatalogCategory[] = catalog.filter((c) => profile?.categories.some((p) => p.id === c.id));

  // "Makeup › Bridal"; rows from before subcategories point straight at a top-level category.
  const where = (subcategoryId: number) => {
    for (const c of catalog) {
      const sub = c.subcategories.find((s) => s.id === subcategoryId);
      if (sub) return `${c.name} › ${sub.name}`;
    }
    return profile?.categories.find((c) => c.id === subcategoryId)?.name ?? '';
  };

  const remove = async (id: string) => {
    setError(null);
    try { await write(() => artistApi.deleteService(id)); } catch (e) { setError(errorMessage(e)); }
  };

  return (
    <FormScreen
      onBack={() => router.dismissTo('/artist/onboarding/profile')}
      step={2}
      steps={4}
      footer={<AppButton label="Continue" onPress={() => { if (services.length) router.push('/artist/onboarding/portfolio'); }} disabled={!services.length} />}
    >
      <FormHeading eyebrow="STEP 2 · SERVICES" title="Set your" accent="prices" subtitle="Add what clients can book. You need at least one service." />
      <View style={{ gap: 10, marginTop: 20 }}>
        {services.map((s) => (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radii.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator }}>
            <View style={{ flex: 1 }}>
              <AppText variant="label" style={{ fontSize: 15, color: theme.colors.textPrimary }}>{s.name}</AppText>
              <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 2 }}>
                {`${where(s.subcategory_id)} · ${formatPrice(s.price_paise)} · ${formatDuration(s.duration_minutes)}`}
              </AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${s.name}`} onPress={() => { void remove(s.id); }} hitSlop={8}>
              <Icon name="close" size={18} color={theme.colors.textMuted} />
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
        categories={mine}
        addedIds={services.flatMap((s) => (s.template_id === null ? [] : [s.template_id]))}
        onClose={() => setSheet(false)}
        onSubmit={async (service) => { await write(() => artistApi.addService(service)); }}
      />
    </FormScreen>
  );
}
