import { View } from 'react-native';
import { PressableFeedback } from './PressableFeedback';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';

export interface Choice<T> {
  value: T;
  label: string;
}

interface ChoiceSheetProps<T> {
  visible: boolean;
  title: string;
  choices: Choice<T>[];
  selected: T;
  onPick: (value: T) => void;
  onClose: () => void;
}

/** A bottom sheet with one tappable row per choice; the current one is ticked. */
export function ChoiceSheet<T>({ visible, title, choices, selected, onPick, onClose }: ChoiceSheetProps<T>) {
  const theme = useTheme();
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <View>
        {choices.map((c) => {
          const on = c.value === selected;
          return (
            <PressableFeedback
              key={c.label}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onPick(c.value)}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: theme.colors.separator }}
            >
              <AppText variant="body" style={{ color: on ? theme.colors.brand : theme.colors.textPrimary, fontWeight: on ? '700' : '400' }}>{c.label}</AppText>
              {on ? <Icon name="check" size={18} color={theme.colors.brand} /> : null}
            </PressableFeedback>
          );
        })}
      </View>
    </BottomSheet>
  );
}
