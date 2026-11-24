import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { PressableFeedback } from '../../src/components/common/PressableFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../src/components/common/AppText';
import { AppButton } from '../../src/components/common/AppButton';
import { BackHeader } from '../../src/components/common/BackHeader';
import { Card } from '../../src/components/common/Card';
import { StatusPill } from '../../src/components/common/StatusPill';
import { EmptyView, ErrorView, LoadingView } from '../../src/components/common/StateViews';
import { useTheme } from '../../src/core/theme/theme-provider';
import { useAddService, useArtistProfile, useDeleteService } from '../../src/hooks/artist-onboarding/artist-onboarding';
import { useAddCustomService, useDeleteCustomService, useUpdateCustomService, useUpdateServicePrice } from '../../src/hooks/artist-services/artist-services';
import { useCategories } from '../../src/hooks/catalog/catalog';
import { CUSTOM_STATUS_PILL, groupMyServices } from '../../src/utils/artist-services/my-services';
import { CustomServiceSheet } from '../../src/components/artist-services/CustomServiceSheet';
import { ServicePriceSheet } from '../../src/components/artist-services/ServicePriceSheet';
import { AddServiceSheet } from '../../src/components/artist-onboarding/AddServiceSheet';
import { formatDuration, formatPrice } from '../../src/utils/common/format';
import { errorMessage } from '../../src/core/api/error-message';
import type { ServiceItem } from '../../src/types/artist-onboarding/artist-onboarding';

/** The open sheet: picking a service from the admin's list, adding or editing one custom service, or repricing a
 *  listed one. */
type SheetState = { mode: 'list' } | { mode: 'add' } | { mode: 'edit'; service: ServiceItem } | { mode: 'price'; service: ServiceItem };

// Spec §2.2 My services: grouped by "Category › Subcategory"; custom services carry a status pill and can be edited
// or deleted. Services from the admin's list are added, repriced and removed here, live with no review.
export default function MyServices() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const profileQuery = useArtistProfile();
  const profile = profileQuery.data;
  const categories = useCategories();
  const addService = useAddCustomService();
  const updateService = useUpdateCustomService();
  const updatePrice = useUpdateServicePrice();
  const deleteCustom = useDeleteCustomService();
  const addListed = useAddService();
  const deleteListed = useDeleteService();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tree = categories.data ?? [];
  // Group titles and the add sheet need the catalog; without it the list would wrongly read "No services yet".
  const failed = profileQuery.isError ? profileQuery : categories.isError ? categories : null;
  const ready = !!profile && !!categories.data;
  const groups = groupMyServices(tree, profile?.services ?? []);

  const mine = tree.filter((c) => profile?.categories.some((p) => p.id === c.id)); // the list offers only the artist's own
  const remove = async (service: ServiceItem) => {
    setError(null);
    try {
      if (service.template_id === null) await deleteCustom.mutateAsync(service.id);
      else await deleteListed.mutateAsync(service.id);
      setConfirmingId(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl, gap: 14 }}>
        <BackHeader title="My services" />
        {failed ? (
          <ErrorView
            error={failed.error}
            onRetry={() => {
              if (profileQuery.isError) void profileQuery.refetch();
              if (categories.isError) void categories.refetch();
            }}
          />
        ) : !ready ? (
          <LoadingView label="Loading your services" />
        ) : (
          <View style={{ gap: 10 }}>
            <AppButton label="Add from the list" onPress={() => setSheet({ mode: 'list' })} />
            <AppButton label="Add a custom service" variant="secondary" onPress={() => setSheet({ mode: 'add' })} />
          </View>
        )}
        {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
        {ready && !groups.length ? <EmptyView message="No services yet. Add one so clients can book you." /> : null}
        {ready && groups.map(([title, services]) => (
          <View key={title} style={{ gap: 8 }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.brand, letterSpacing: 1.2 }}>{title}</AppText>
            {services.map((s) => (
              <ServiceRow
                key={s.id}
                service={s}
                confirming={confirmingId === s.id}
                deleting={deleteCustom.isPending || deleteListed.isPending}
                onEdit={() => setSheet({ mode: s.template_id === null ? 'edit' : 'price', service: s })}
                onAskDelete={() => setConfirmingId(s.id)}
                onCancelDelete={() => setConfirmingId(null)}
                onDelete={() => { void remove(s); }}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <AddServiceSheet
        visible={sheet?.mode === 'list'}
        categories={mine}
        addedIds={(profile?.services ?? []).flatMap((s) => (s.template_id === null ? [] : [s.template_id]))}
        onClose={() => setSheet(null)}
        onSubmit={async (service) => { await addListed.mutateAsync(service); }}
      />
      {sheet?.mode === 'price' ? (
        <ServicePriceSheet
          key={sheet.service.id}
          service={sheet.service}
          onClose={() => setSheet(null)}
          onSubmit={async (input) => { await updatePrice.mutateAsync({ id: sheet.service.id, input }); }}
        />
      ) : sheet && sheet.mode !== 'list' ? (
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
      {!custom && !confirming ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <RowAction label="Edit price" accessibilityLabel={`Edit price of ${service.name}`} onPress={onEdit} />
          <RowAction label="Delete" accessibilityLabel={`Delete ${service.name}`} onPress={onAskDelete} muted />
        </View>
      ) : null}
      {confirming ? (
        <View style={{ gap: 8, marginTop: 4 }}>
          <AppText variant="body" style={{ color: theme.colors.textSecondary }}>Delete this service? Customers won’t see it any more.</AppText>
          <AppButton label="Yes, delete" loading={deleting} onPress={onDelete} />
          <AppButton label="Keep it" variant="outline" disabled={deleting} onPress={onCancelDelete} />
        </View>
      ) : null}
    </Card>
  );
}

function RowAction({ label, accessibilityLabel, onPress, muted = false }: { label: string; accessibilityLabel: string; onPress: () => void; muted?: boolean }) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={{ height: 34, paddingHorizontal: 14, borderRadius: theme.radii.pill, justifyContent: 'center', backgroundColor: muted ? theme.colors.neutralSoft : theme.colors.brandSoft }}
    >
      <AppText variant="label" style={{ fontSize: 13, color: muted ? theme.colors.textSecondary : theme.colors.brand }}>{label}</AppText>
    </PressableFeedback>
  );
}
