import { ScrollView } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';

export interface StorefrontTab {
  key: string;
  label: string;
}

interface StorefrontTabsProps {
  tabs: StorefrontTab[];
  onSelect: (key: string) => void;
}

/** Work · Services · Posts · Reviews · About: each jumps to its section of the page. */
export function StorefrontTabs({ tabs, onSelect }: StorefrontTabsProps) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing.lg, paddingHorizontal: theme.spacing.md }}
      style={{ marginTop: 20, borderBottomWidth: 1, borderBottomColor: theme.colors.separator, flexGrow: 0 }}
    >
      {tabs.map((t) => (
        <PressableFeedback key={t.key} accessibilityRole="link" accessibilityLabel={`Go to ${t.label}`} onPress={() => onSelect(t.key)} hitSlop={8} style={{ paddingVertical: 12 }}>
          <AppText variant="label" style={{ fontSize: 14, color: theme.colors.textSecondary }}>{t.label}</AppText>
        </PressableFeedback>
      ))}
    </ScrollView>
  );
}
