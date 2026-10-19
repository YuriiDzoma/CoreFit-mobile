import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { upsertPushToken } from '@/lib/supabase/push-tokens';

// Foreground behavior -- without this, iOS/Android both suppress a
// notification entirely while the app is open (the default). This app
// wants it to still show (banner + sound), since there's no in-app
// "new message" toast of its own for the common case of sitting on a
// screen other than the conversation that just received one.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const EAS_PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

/**
 * Requests notification permission (a no-op if already granted or
 * already permanently denied) and, if granted, registers this device's
 * Expo push token against `userId`. Silently gives up rather than
 * throwing on any failure along the way (no permission, no physical
 * device, no network) -- push is an enhancement, never something sign-in
 * or the Messages screen should block on.
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (!Device.isDevice) return;
  if (!EAS_PROJECT_ID) return;

  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });
    await upsertPushToken(userId, 'expo', token);
  } catch {
    // Enhancement only -- see the function comment above.
  }
}

/** Fires `onTap` with the conversation id when the user taps a message
 * push notification (from the lock screen, notification shade, or the app
 * already open) -- the one piece of the notification's `data` this app's
 * own `send-message-push` Edge Function sends. Returns the subscription's
 * own `remove()`, same shape as every other `() => void` cleanup in this
 * app (`subscribeToAppStateAutoRefresh`, the Realtime stores). */
export function subscribeToNotificationTaps(onTap: (conversationId: string) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const conversationId = response.notification.request.content.data?.conversationId;
    if (typeof conversationId === 'string') onTap(conversationId);
  });
  return () => subscription.remove();
}
