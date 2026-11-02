// Local notifications on devices (blueprint 7.1). Web gets notifications.web.ts.

import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationKind } from '@/domain/notifications';

export type ScheduledNotification = {
  id: string;
  kind: NotificationKind;
  at: number;
  title: string;
  body: string;
};

export type NotificationTap = { id: string; kind: NotificationKind };

const CHANNEL = 'vinnie';
const CALL_CHANNEL = 'vinnie-calls';

export async function configureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Vinnie',
      importance: AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(CALL_CHANNEL, {
      name: 'Calls from Vinnie',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 700, 500, 700],
    });
  }
}

export async function notificationsAllowed(): Promise<boolean> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

export async function requestNotifications(): Promise<boolean> {
  if (await notificationsAllowed()) return true;
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}

/** Replaces everything scheduled with this plan. */
export async function scheduleAll(list: ScheduledNotification[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const n of list) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { id: n.id, kind: n.kind } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: n.at,
        channelId: n.kind === 'proactive_call' ? CALL_CHANNEL : CHANNEL,
      },
    });
  }
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function tapFrom(r: Notifications.NotificationResponse | null): NotificationTap | null {
  const data = r?.notification.request.content.data as Partial<NotificationTap> | undefined;
  return data?.id && data.kind ? { id: data.id, kind: data.kind } : null;
}

/** Calls `onTap` when a notification is tapped, including the one that opened the app. */
export function listenForTaps(onTap: (t: NotificationTap) => void): () => void {
  Notifications.getLastNotificationResponseAsync().then((r) => {
    const t = tapFrom(r);
    if (t) {
      onTap(t);
      Notifications.clearLastNotificationResponseAsync();
    }
  });
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const t = tapFrom(r);
    if (t) onTap(t);
  });
  return () => sub.remove();
}
