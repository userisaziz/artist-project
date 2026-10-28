import { Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from '../../core/theme/theme-provider';

interface SegmentedProps<K extends string> {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}

/** Atelier blush switch (Upcoming / Past, Requests · n / Upcoming / Past). */
export function Segmented<K extends string>({ options, value, onChange }: SegmentedProps<K>) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: theme.spacing[0.75], borderRadius: theme.radii.md, backgroundColor: theme.colors.brandSoft }}>
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.key)}
            style={[{ flex: 1, height: 34, borderRadius: theme.radii.control, alignItems: 'center', justifyContent: 'center' }, selected && { backgroundColor: theme.colors.surface }, selected && theme.shadows.sm]}
          >
            <AppText variant="labelLg" style={{ color: selected ? theme.colors.textPrimary : theme.colors.textMuted }}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
