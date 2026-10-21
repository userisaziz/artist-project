import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Push infrastructure behind one module so features never import expo-notifications directly.

export type PushPlatform = 'ios' | 'android';
export interface PushToken { token: string; platform: PushPlatform }

const ANDROID_CHANNEL = 'default';
const NO_OP = () => undefined;
let lastOpenedId: string | null = null;

/**
 * Runs a synchronous expo-notifications call. A build without the native module (an Expo Go or dev client made
 * before expo-notifications was added) throws here; pushes are an extra on top of the in-app inbox, so the app
 * carries on without them and says why in development.
 */
function withNativePush<T>(call: () => T, fallback: T): T {
  try {
    return call();
  } catch (error) {
    if (__DEV__) console.warn('Push notifications are off in this build (rebuild the dev client):', error);
    return fallback;
  }
}

/** A banner while the app is open, too: the bell's badge alone is easy to miss. */
export function configureForegroundPushes(): void {
  withNativePush(() => Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  }), undefined);
}

/**
 * Asks for permission (once; the OS remembers the answer) and returns this device's Expo push token.
 * Null when pushes cannot work here: permission refused, web, or a build without an EAS project id.
 */
export async function getPushToken(): Promise<PushToken | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || !projectId) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, { name: 'Bookings and messages', importance: Notifications.AndroidImportance.HIGH });
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
  if (!granted) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token: data, platform: Platform.OS };
}

/** The in-app path a push carries in `data.link`; anything that is not an app-relative path is ignored. */
function linkOf(response: Notifications.NotificationResponse): string | null {
  const link: unknown = response.notification.request.content.data?.link;
  return typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : null;
}

/**
 * Calls `onOpen` with the push's link when the user taps a push, including the tap that cold-started the app.
 * Returns the unsubscribe function.
 */
export function onPushOpened(onOpen: (link: string) => void): () => void {
  const open = (response: Notifications.NotificationResponse | null) => {
    if (!response || response.notification.request.identifier === lastOpenedId) return;
    lastOpenedId = response.notification.request.identifier; // the cold-start tap stays "last" for the whole run
    const link = linkOf(response);
    if (link) onOpen(link);
  };
  return withNativePush(() => {
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, NO_OP);
}

/** Calls `onReceive` for every push that arrives while the app is in the foreground. */
export function onPushReceived(onReceive: () => void): () => void {
  return withNativePush(() => {
    const sub = Notifications.addNotificationReceivedListener(() => onReceive());
    return () => sub.remove();
  }, NO_OP);
}
