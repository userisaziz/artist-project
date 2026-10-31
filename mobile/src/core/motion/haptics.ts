import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** What the finger is being told, not which API to call — the mapping to expo-haptics lives here, once,
 *  so a caller never picks between impactAsync / selectionAsync / notificationAsync. */
export type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'error';

const NOTIFY = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
} as const;

/** Fire-and-forget buzz. Never awaited and never rethrown: a buzz is a nicety, so a device with no
 *  vibrator (and the web target) must degrade to silence rather than to a rejected promise. */
export function haptic(kind: HapticKind): void {
  if (Platform.OS === 'web') return;
  const fire = (): Promise<void> => {
    switch (kind) {
      case 'tap': return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'select': return Haptics.selectionAsync();
      default: return Haptics.notificationAsync(NOTIFY[kind]);
    }
  };
  fire().catch(() => {});
}
