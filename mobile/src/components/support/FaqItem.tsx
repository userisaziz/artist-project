import { useState } from 'react';
import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { Icon } from '../common/Icon';

/** Design "Common questions" row: the question, opening to its answer. */
export function FaqItem({ question, answer }: { question: string; answer: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.separator }}>
      <PressableFeedback
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 }}
      >
        <AppText variant="label" style={{ flex: 1, color: theme.colors.textPrimary }}>{question}</AppText>
        <Icon name={open ? 'minus' : 'plus'} size={18} color={theme.colors.brand} />
      </PressableFeedback>
      {open ? <AppText variant="body" style={{ paddingBottom: 14, color: theme.colors.textSecondary }}>{answer}</AppText> : null}
    </View>
  );
}
