import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../src/components/common/AppText';
import { AppButton } from '../../src/components/common/AppButton';
import { BackHeader } from '../../src/components/common/BackHeader';
import { Card } from '../../src/components/common/Card';
import { StatusPill } from '../../src/components/common/StatusPill';
import { EmptyView } from '../../src/components/common/StateViews';
import { useTheme } from '../../src/core/theme/theme-provider';
import { useArtistProfile } from '../../src/hooks/artist-onboarding/artist-onboarding';
import { useAddCustomService, useDeleteCustomService, useUpdateCustomService, useUpdateServicePrice } from '../../src/hooks/artist-services/artist-services';
import { useCategories } from '../../src/hooks/catalog/catalog';
import { CUSTOM_STATUS_PILL, groupMyServices } from '../../src/utils/artist-services/my-services';
import { CustomServiceSheet } from '../../src/components/artist-services/CustomServiceSheet';
import { ServicePriceSheet } from '../../src/components/artist-services/ServicePriceSheet';
import { formatDuration, formatPrice } from '../../src/utils/common/format';
import { errorMessage } from '../../src/core/api/error-message';
import type { ServiceItem } from '../../src/types/artist-onboarding/artist-onboarding';

/** The open sheet: adding, editing one custom service, or repricing one from the admin's list. */
type SheetState = { mode: 'add' } | { mode: 'edit'; service: ServiceItem } | { mode: 'price'; service: ServiceItem };

// Spec §2.2 My services: grouped by "Category › Subcategory"; custom services carry a status pill and can be edited
// or deleted. Services picked from the admin list only change price and duration here, live with no review.
export default function MyServices() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: profile } = useArtistProfile();
  const categories = useCategories();
  const addService = useAddCustomService();
  const updateService = useUpdateCustomService();
  const updatePrice = useUpdateServicePrice();
  const deleteService = useDeleteCustomService();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tree = categories.data ?? [];
  const groups = groupMyServices(tree, profile?.services ?? []);

  const remove = async (id: string) => {
    setError(null);
    try {
      await deleteService.mutateAsync(id);
      setConfirmingId(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl, gap: 14 }}>
        <BackHeader title="My services" />
        <AppButton label="Add a custom service" onPress={() => setSheet({ mode: 'add' })} />
        {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
        {!groups.length ? <EmptyView message="No services yet." /> : null}
        {groups.map(([title, services]) => (
          <View key={title} style={{ gap: 8 }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.brand, letterSpacing: 1.2 }}>{title}</AppText>
            {services.map((s) => (
              <ServiceRow
                key={s.id}
                service={s}
                confirming={confirmingId === s.id}
                deleting={deleteService.isPending}
                onEdit={() => setSheet({ mode: s.template_id === null ? 'edit' : 'price', service: s })}
                onAskDelete={() => setConfirmingId(s.id)}
                onCancelDelete={() => setConfirmingId(null)}
                onDelete={() => { void remove(s.id); }}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      {sheet?.mode === 'price' ? (
        <ServicePriceSheet
          key={sheet.service.id}
          service={sheet.service}
          onClose={() => setSheet(null)}
          onSubmit={async (input) => { await updatePrice.mutateAsync({ id: sheet.service.id, input }); }}
        />
      ) : sheet ? (
        <CustomServiceSheet
          key={sheet.mode === 'edit' ? sheet.service.id : 'add'}
          categories={tree}
          service={sheet.mode === 'edit' ? sheet.service : undefined}
          onClose={() => setSheet(null)}
          onSubmit={async (input) => {
            // The sheet shows its own pending/error state from this promise.
            if (sheet.mode === 'edit') await updateService.mutateAsync({ id: sheet.service.id, input });
            else await addService.mutateAsync(input);
          }}
        />
      ) : null}
    </View>
  );
}

interface ServiceRowProps {
  service: ServiceItem;
  confirming: boolean;
  deleting: boolean;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}

function ServiceRow({ service, confirming, deleting, onEdit, onAskDelete, onCancelDelete, onDelete }: ServiceRowProps) {
  const theme = useTheme();
  const custom = service.template_id === null;
  const pill = custom ? CUSTOM_STATUS_PILL[service.status] : null;
  return (
    <Card style={{ gap: 6 }}>
      {pill ? <StatusPill label={pill.label} tone={pill.tone} /> : null}
      <AppText variant="subtitle" style={{ fontSize: 15, color: theme.colors.textPrimary }}>{service.name}</AppText>
      <AppText variant="label" style={{ color: theme.colors.textMuted }}>{`${formatPrice(service.price_paise)} · ${formatDuration(service.duration_minutes)}`}</AppText>
      {custom && service.status === 'rejected' && service.rejection_reason ? (
        <AppText variant="caption" style={{ color: theme.colors.error }}>{`Reason: ${service.rejection_reason}`}</AppText>
      ) : null}
      {custom && !confirming ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <RowAction label="Edit" accessibilityLabel={`Edit ${service.name}`} onPress={onEdit} />
          <RowAction label="Delete" accessibilityLabel={`Delete ${service.name}`} onPress={onAskDelete} muted />
        </View>
      ) : null}
      {!custom ? (
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          <RowAction label="Edit price" accessibilityLabel={`Edit price of ${service.name}`} onPress={onEdit} />
        </View>
      ) : null}
      {custom && confirming ? (
        <View style={{ gap: 8, marginTop: 4 }}>
          <AppText variant="body" style={{ color: theme.colors.textSecondary }}>Delete this service? Customers won’t see it any more.</AppText>
          <AppButton label="Yes, delete" loading={deleting} onPress={onDelete} />
          <AppButton label="Keep it" variant="ghost" disabled={deleting} onPress={onCancelDelete} />
        </View>
      ) : null}
    </Card>
  );
}

function RowAction({ label, accessibilityLabel, onPress, muted = false }: { label: string; accessibilityLabel: string; onPress: () => void; muted?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={{ height: 34, paddingHorizontal: 14, borderRadius: theme.radii.pill, justifyContent: 'center', backgroundColor: muted ? theme.colors.neutralSoft : theme.colors.brandSoft }}
    >
      <AppText variant="label" style={{ fontSize: 13, color: muted ? theme.colors.textSecondary : theme.colors.brand }}>{label}</AppText>
    </Pressable>
  );
}
