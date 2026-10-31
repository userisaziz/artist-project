import { ScrollView, View } from 'react-native';
import { PressableFeedback } from './PressableFeedback';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from './AppText';
import { KeyboardAvoider } from './KeyboardAvoider';
import { useTheme } from '../../core/theme/theme-provider';
import { Icon } from './Icon';

const AUTH_STEPS = 3; // Log in → Verify → Your details (artist onboarding passes its own count)

/**
 * Atelier form frame (Log in, code, sign-up): blush page, round back button beside a 3-step progress bar,
 * keyboard-safe scroll body, and an optional footer (the primary button) pinned above the keyboard.
 */
export function FormScreen({ onBack, step, steps = AUTH_STEPS, footer, children }: { onBack?: () => void; step?: number; steps?: number; footer?: ReactNode; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const gutter = theme.spacing.md + theme.spacing.xs;
  return (
    <KeyboardAvoider style={{ backgroundColor: theme.colors.canvas }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: gutter, paddingBottom: theme.spacing.md }}
      >
        {onBack || step ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
            {onBack ? (
              <PressableFeedback
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={onBack}
                style={{ width: 40, height: 40, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="chevron-left" size={22} />
              </PressableFeedback>
            ) : null}
            {step ? (
              <View style={{ flex: 1, flexDirection: 'row', gap: theme.spacing[1.5] }} accessibilityLabel={`Step ${step} of ${steps}`}>
                {Array.from({ length: steps }, (_, i) => (
                  <View key={i} style={{ flex: 1, height: 4, borderRadius: theme.radii.pill, backgroundColor: i < step ? theme.colors.brand : theme.colors.progressTrack }} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer ? (
        <View style={{ paddingHorizontal: gutter, paddingTop: theme.spacing[2.5], paddingBottom: insets.bottom + theme.spacing[2.5], backgroundColor: theme.colors.canvas }}>{footer}</View>
      ) : null}
    </KeyboardAvoider>
  );
}

/** Eyebrow + headline ending in an italic accent word + optional subtitle, as every Atelier form step opens. */
export function FormHeading({ eyebrow, title, accent, subtitle }: { eyebrow: string; title: string; accent: string; subtitle?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ paddingTop: theme.spacing.md + theme.spacing.xs }}>
      <AppText variant="formEyebrow" style={{ color: theme.colors.brand }}>{eyebrow}</AppText>
      <AppText variant="formTitle" style={{ color: theme.colors.heading, marginTop: theme.spacing.sm }}>
        {`${title} `}<Accent light color={theme.colors.brand}>{accent}</Accent>
      </AppText>
      {subtitle ? (
        <AppText variant="bodySm" style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.sm }}>{subtitle}</AppText>
      ) : null}
    </View>
  );
}
