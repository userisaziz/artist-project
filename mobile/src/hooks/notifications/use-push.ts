import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as notificationsApi from '../../api/notifications/notifications';
import { useAuth } from '../../context/auth/auth-provider';
import { configureForegroundPushes, getPushToken, onPushOpened, onPushReceived } from '../../core/push/push';
import { notificationKeys } from './notifications';

configureForegroundPushes();

/**
 * While someone is signed in: registers this device for pushes, refreshes the inbox when one arrives, and opens a
 * tapped push's link via `navigate`. Sign-out unregisters the device so the next account never gets the last one's pushes.
 */
export function usePushNotifications(navigate: (link: string) => void): void {
  const { user, onSignOut } = useAuth();
  const client = useQueryClient();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let unsubscribeSignOut: (() => void) | null = null;
    getPushToken()
      .then(async (device) => {
        if (!device || cancelled) return;
        await notificationsApi.registerDevice(device);
        if (cancelled) return;
        unsubscribeSignOut = onSignOut(() => {
          // Best effort, like logout itself: sign-out must not wait on or fail because of the network.
          notificationsApi.removeDevice(device).catch(() => undefined);
        });
      })
      // Pushes are an extra on top of the in-app inbox, so a refused permission or a failed register never blocks the app.
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unsubscribeSignOut?.();
    };
  }, [userId, onSignOut]);

  useEffect(() => {
    if (!userId) return;
    const stopOpened = onPushOpened(navigate);
    const stopReceived = onPushReceived(() => { void client.invalidateQueries({ queryKey: notificationKeys.all(userId) }); });
    return () => { stopOpened(); stopReceived(); };
  }, [userId, navigate, client]);
}
