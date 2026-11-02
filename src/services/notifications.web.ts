// Web has no local notifications; everything here is a no-op so the app runs.

import type { NotificationKind } from '@/domain/notifications';

export type ScheduledNotification = {
  id: string;
  kind: NotificationKind;
  at: number;
  title: string;
  body: string;
};

export type NotificationTap = { id: string; kind: NotificationKind };

export async function configureNotifications(): Promise<void> {}
export async function notificationsAllowed(): Promise<boolean> {
  return false;
}
export async function requestNotifications(): Promise<boolean> {
  return false;
}
export async function scheduleAll(_list: ScheduledNotification[]): Promise<void> {}
export async function cancelAll(): Promise<void> {}
export function listenForTaps(_onTap: (t: NotificationTap) => void): () => void {
  return () => {};
}
