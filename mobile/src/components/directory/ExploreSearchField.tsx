import type { Ref } from 'react';
import { TextInput, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface ExploreSearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Lets the screen act on the keyboard's Search key, e.g. dismiss it to show the results. */
  onSubmitEditing?: () => void;
  /** Lets the screen focus the field, e.g. when Home's search bar opens Explore. */
  ref?: Ref<TextInput>;
}

// The platform's minimum touch target, for the clear button's hitSlop.
const MIN_TOUCH = 44;

/** Explore's search box: a magnifier, the input, and a clear button once there is text. */
export function ExploreSearchField({ value, onChangeText, onSubmitEditing, ref }: ExploreSearchFieldProps) {
  const theme = useTheme();
  const glyph = theme.typography.subtitle.fontSize;
  const slop = Math.max(0, (MIN_TOUCH - glyph) / 2);
  return (
    <View
      style={{
        marginTop: theme.spacing[3.5], height: theme.spacing[12], borderRadius: theme.radii.md, backgroundColor: theme.colors.brandSoft,
        borderWidth: 1, borderColor: theme.colors.separator, flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2.5], paddingHorizontal: theme.spacing[3.5],
      }}
    >
      <Icon name="search" size={glyph} color={theme.colors.brand} />
      <TextInput
        ref={ref}
        accessibilityLabel="Search artists"
        placeholder="Search artists or services"
        placeholderTextColor={theme.colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        cursorColor={theme.colors.brand}
        style={{ flex: 1, alignSelf: 'stretch', color: theme.colors.textPrimary, fontFamily: theme.typography.body.fontFamily, fontSize: theme.typography.body.fontSize }}
      />
      {value ? (
        <PressableFeedback accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText('')} hitSlop={slop}>
          <Icon name="close" size={glyph} color={theme.colors.textMuted} />
        </PressableFeedback>
      ) : null}
    </View>
  );
}
