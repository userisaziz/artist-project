import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from './AppText';
import { useTheme } from '../theme/theme-provider';

const STEPS = 3; // Log in → Verify → Your details

/**
 * Atelier form frame (Log in, code, sign-up): blush page, round back button beside a 3-step progress bar,
 * keyboard-safe scroll body, and an optional footer (the primary button) pinned above the keyboard.
 */
export function FormScreen({ onBack, step, footer, children }: { onBack?: () => void; step?: number; footer?: ReactNode; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const gutter = theme.spacing.md + theme.spacing.xs;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: gutter, paddingBottom: theme.spacing.md }}
      >
        {onBack || step ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={onBack}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' }}
              >
                <AppText style={{ fontSize: 20, lineHeight: 24, color: theme.colors.textPrimary }}>‹</AppText>
              </Pressable>
            ) : null}
            {step ? (
              <View style={{ flex: 1, flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${step} of ${STEPS}`}>
                {Array.from({ length: STEPS }, (_, i) => (
                  <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? theme.colors.brand : theme.colors.progressTrack }} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer ? (
        <View style={{ paddingHorizontal: gutter, paddingTop: 10, paddingBottom: insets.bottom + 10, backgroundColor: theme.colors.canvas }}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** Eyebrow + headline ending in an italic accent word + optional subtitle, as every Atelier form step opens. */
export function FormHeading({ eyebrow, title, accent, subtitle }: { eyebrow: string; title: string; accent: string; subtitle?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ paddingTop: theme.spacing.md + theme.spacing.xs }}>
      <AppText variant="eyebrow" style={{ fontSize: 10.5, letterSpacing: 2.5, color: theme.colors.brand }}>{eyebrow}</AppText>
      <AppText variant="display" style={{ fontSize: 25, lineHeight: 26, letterSpacing: -0.62, color: theme.colors.heading, marginTop: theme.spacing.sm }}>
        {`${title} `}<Accent light color={theme.colors.brand}>{accent}</Accent>
      </AppText>
      {subtitle ? (
        <AppText variant="body" style={{ fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, marginTop: theme.spacing.sm }}>{subtitle}</AppText>
      ) : null}
    </View>
  );
}
