import { ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { timings, useReducedMotion } from '../../core/motion/motion';
import { useTheme } from '../../core/theme/theme-provider';
import { PressableFeedback } from './PressableFeedback';
import { AppText } from './AppText';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  /** Overrides the label for screen readers when several buttons share one, e.g. "Accept Ananya Rao". */
  accessibilityLabel?: string;
}

export function AppButton({ label, onPress, variant = 'primary', loading = false, disabled = false, accessibilityLabel }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const inactive = disabled || loading;
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary'; // white pill with a hairline border, e.g. "I already have an account"
  const pressed = useSharedValue(0);
  // The pressed surface eases in over `quick`; reduced motion flips it instantly. It paints on an
  // absolute layer inside the button so the ease animates on every path (dip active or not). A button
  // that turns inactive while it is held drops the pressed colour too, not only on the next press.
  const surface = useAnimatedStyle(() => {
    const down = pressed.value && !inactive;
    const target = isPrimary
      ? down ? theme.colors.brandPressed : theme.colors.brand
      : isSecondary ? theme.colors.surface : 'transparent';
    return { backgroundColor: withTiming(target, { duration: reduced ? 0 : timings.quick.duration, easing: timings.base.easing }) };
  });
  return (
    <PressableFeedback
      feedback={false}
      scale
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={inactive ? undefined : onPress}
      // A disabled button still receives onPressIn (no `disabled` prop is passed, only a dropped
      // onPress), and it must not answer with the brandPressed surface.
      onPressIn={() => { if (!inactive) pressed.set(1); }}
      onPressOut={() => { pressed.set(0); }}
      style={(state) => [
        {
          height: 52,
          borderRadius: theme.radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isPrimary ? theme.colors.brand : isSecondary ? theme.colors.surface : 'transparent',
          borderColor: isPrimary ? 'transparent' : isSecondary ? theme.colors.separator : theme.colors.brand,
          borderWidth: isPrimary ? 0 : 1,
          opacity: inactive ? 0.4 : state.pressed && !isPrimary ? 0.85 : 1,
        },
        isPrimary ? theme.shadows.md : {},
      ]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: theme.radii.pill }, surface]} />
      {loading ? (
        <ActivityIndicator testID="app-button-spinner" color={isPrimary ? theme.colors.textOnBrand : theme.colors.brand} />
      ) : (
        <AppText variant="button" style={{ color: isPrimary ? theme.colors.textOnBrand : isSecondary ? theme.colors.textPrimary : theme.colors.brand }}>
          {label}
        </AppText>
      )}
    </PressableFeedback>
  );
}
