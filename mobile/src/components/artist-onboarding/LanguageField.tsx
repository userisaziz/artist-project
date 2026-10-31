import { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { fieldBorder } from '../common/FieldHalo';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface LanguageFieldProps {
  /** Shown above the field and reused as its screen-reader name, so the two can't drift. */
  label: string;
  /** The languages picked so far, in the order the artist picked them. */
  languages: string[];
  options: readonly string[];
  onChange: (next: string[]) => void;
}

/**
 * The city picker's shape, but for many: a field that carries the chosen languages as removable badges and
 * opens a bottom sheet over the full list. The sheet stays open while the artist taps, so picking four
 * languages is one visit, not four.
 */
export function LanguageField({ label, languages, options, onChange }: LanguageFieldProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  // The rule the chip row already used: a picked language is dropped, an unpicked one is appended.
  const toggle = (language: string) =>
    onChange(languages.includes(language) ? languages.filter((l) => l !== language) : [...languages, language]);

  return (
    <View>
      <AppText variant="label" style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>{label}</AppText>
      <PressableFeedback
        accessibilityRole="button"
        accessibilityLabel={languages.length ? `${label}: ${languages.join(', ')}` : label}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 50, borderRadius: theme.radii.md, ...fieldBorder(theme.colors, false, false),
          backgroundColor: theme.colors.inputBackground, padding: theme.spacing[2],
          flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6,
        }}
      >
        {languages.length === 0 ? (
          <AppText variant="subtitle" style={{ color: theme.colors.textMuted, flex: 1 }}>Choose the languages you speak</AppText>
        ) : (
          languages.map((language) => (
            <View
              key={language}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6,
                borderRadius: theme.radii.pill, backgroundColor: theme.colors.brandSoft,
              }}
            >
              <AppText variant="caption" style={{ color: theme.colors.textPrimary }}>{language}</AppText>
              <PressableFeedback hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${language}`} onPress={() => toggle(language)}>
                <Icon name="close" size={12} color={theme.colors.brand} />
              </PressableFeedback>
            </View>
          ))
        )}
        <AppText style={{ color: theme.colors.brand }}>▾</AppText>
      </PressableFeedback>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <PressableFeedback feedback={false} accessibilityLabel="Close" style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setOpen(false)} />
        <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: insets.bottom + 12, maxHeight: '80%' }}>
          <AppText variant="label" style={{ color: theme.colors.textSecondary, paddingHorizontal: 24, paddingBottom: 4 }}>{label}</AppText>
          {/* Eleven options overflow a small screen, so the sheet is capped and the list gives way to the pinned footer. */}
          <ScrollView bounces={false} style={{ flexGrow: 0, flexShrink: 1 }}>
            {options.map((language) => {
              const selected = languages.includes(language);
              return (
                <PressableFeedback
                  key={language}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggle(language)}
                  style={{ paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{language}</AppText>
                  {selected ? <Icon name="check" size={18} color={theme.colors.brand} /> : null}
                </PressableFeedback>
              );
            })}
          </ScrollView>
          <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
            <AppButton label="Done" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
