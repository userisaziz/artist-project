import { AppText, Accent, View, useTheme } from '@art-circle/atelier-mobile';

export function InDisplayTitle() {
  const theme = useTheme();
  return (
    <AppText variant="display" style={{ color: theme.colors.brandInk, width: 340 }}>
      {'What brings you '}<Accent light color={theme.colors.accent}>here?</Accent>
    </AppText>
  );
}

export function BoldVsLight() {
  const theme = useTheme();
  return (
    <View style={{ gap: 12, width: 340 }}>
      <AppText variant="display" style={{ color: theme.colors.textPrimary }}>
        {'Welcome '}<Accent>back</Accent>
      </AppText>
      <AppText variant="display" style={{ color: theme.colors.textPrimary }}>
        {'Enter the '}<Accent light>code</Accent>
      </AppText>
    </View>
  );
}

export function OnHeroHeadline() {
  const theme = useTheme();
  return (
    <AppText variant="hero" style={{ color: theme.colors.textPrimary, width: 340 }}>
      {'Discover\nyour '}<Accent light color={theme.colors.brandOnImage}>artist.</Accent>
    </AppText>
  );
}
