import { Platform, Pressable, type PressableProps, type PressableStateCallbackType } from 'react-native';
import { useTheme } from '../../core/theme/theme-provider';

const PRESSED_OPACITY = 0.6;

interface PressableFeedbackProps extends PressableProps {
  /** Off for surfaces that aren't controls, e.g. a sheet's backdrop, so tapping it doesn't flash the screen. */
  feedback?: boolean;
}

/** Every tappable thing in the app: it answers the finger at once (a ripple on Android, a dim on iOS), so a tap
 *  never feels missed while the work behind it runs. Plain Pressable shows nothing on press. */
export function PressableFeedback({ feedback = true, style, android_ripple, ...rest }: PressableFeedbackProps) {
  const theme = useTheme();
  const responds = feedback && !rest.disabled && !!(rest.onPress || rest.onLongPress);
  const ripple = responds && Platform.OS === 'android'
    ? android_ripple ?? { color: theme.colors.pressedOverlay, foreground: true }
    : android_ripple;
  const pressedStyle = (state: PressableStateCallbackType) => {
    const base = typeof style === 'function' ? style(state) : style;
    return responds && state.pressed && Platform.OS !== 'android' ? [base, { opacity: PRESSED_OPACITY }] : base;
  };
  return <Pressable {...rest} android_ripple={ripple} style={pressedStyle} />;
}
