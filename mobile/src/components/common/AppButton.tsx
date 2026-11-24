import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { timings, useReducedMotion } from '../../core/motion/motion';
import { useTheme } from '../../core/theme/theme-provider';
import type { ThemeColors } from '../../core/theme/types';
import { PressableFeedback } from './PressableFeedback';
import { AppText } from './AppText';
import { BrushLoader } from './BrushLoader';

type Variant = 'primary' | 'secondary' | 'outline';

interface Props {
  label: string;
  onPress: () => void;
  /** Cherry Red kit: `primary` is the main action (flat cherry, soft pink shadow); `secondary` a rose-tint pill;
   *  `outline` a white pill with a cherry border, for quieter or backing-out actions. */
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Overrides the label for screen readers when several buttons share one, e.g. "Accept Ananya Rao". */
  accessibilityLabel?: string;
}

const OUTLINE_WIDTH = 1.5;
const INACTIVE_OPACITY = 0.5;

/** Fill at rest and when pressed, the label and the border, per variant. */
function look(variant: Variant, c: ThemeColors) {
  if (variant === 'primary') return { rest: c.brand, down: c.brandPressed, ink: c.textOnBrand, border: 'transparent', borderWidth: 0 };
  if (variant === 'secondary') return { rest: c.brandSoft, down: c.brandSoftPressed, ink: c.brandInk, border: c.brandSoftBorder, borderWidth: 1 };
  return { rest: c.surface, down: c.brandSoft, ink: c.brand, border: c.brand, borderWidth: OUTLINE_WIDTH };
}

export function AppButton({ label, onPress, variant = 'primary', loading = false, disabled = false, accessibilityLabel }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const inactive = disabled || loading;
  const isPrimary = variant === 'primary';
  // A disabled primary keeps the kit's blush fill and rose label; a busy one stays cherry under its loader.
  const muted = isPrimary && disabled && !loading;
  const v = look(variant, theme.colors);
  const rest = muted ? theme.colors.disabledFill : v.rest;
  const pressed = useSharedValue(0);
  // The pressed fill eases in over `quick`; reduced motion flips it instantly. It paints on an absolute layer inside
  // the button so the ease animates on every path. A button that turns inactive while held drops it too.
  const surface = useAnimatedStyle(() => {
    const down = pressed.value && !inactive;
    return { backgroundColor: withTiming(down ? v.down : rest, { duration: reduced ? 0 : timings.quick.duration, easing: timings.base.easing }) };
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
      // A disabled button still receives onPressIn (no `disabled` prop is passed, only a dropped onPress), and it
      // must not answer with the pressed fill.
      onPressIn={() => { if (!inactive) pressed.set(1); }}
      onPressOut={() => { pressed.set(0); }}
      style={[
        {
          height: 52,
          paddingHorizontal: theme.spacing[3],
          borderRadius: theme.radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: rest,
          borderColor: v.border,
          borderWidth: v.borderWidth,
          opacity: inactive && !isPrimary ? INACTIVE_OPACITY : 1,
        },
        isPrimary && !muted ? theme.shadows.md : {},
      ]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: theme.radii.pill }, surface]} />
      {loading ? (
        <BrushLoader testID="app-button-spinner" tone={isPrimary ? 'onBrand' : 'brand'} />
      ) : (
        <AppText variant="button" numberOfLines={1} adjustsFontSizeToFit style={{ color: muted ? theme.colors.disabledInk : v.ink }}>
          {label}
        </AppText>
      )}
    </PressableFeedback>
  );
}
