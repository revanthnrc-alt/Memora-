// localNotifications.ts
// Best-effort wrapper that uses Capacitor Local Notifications on native
// and falls back to Web Notification API on the web.

export const isNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform && (window as any).Capacitor.isNativePlatform();

type NotifyPermission = 'granted' | 'denied' | 'prompt' | 'default';
type NotificationActionHandler = { remove: () => Promise<void> } | { remove: () => void } | null;

let nativeActionListener: NotificationActionHandler = null;
let nativeListenerInitialized = false;
let nativeChannelInitialized = false;

const ensureNativeActionListener = async (LocalNotifications: any) => {
  if (nativeListenerInitialized || !LocalNotifications?.addListener) return;
  nativeActionListener = await LocalNotifications.addListener('localNotificationActionPerformed', (event: any) => {
    try {
      const actionId = event.actionId;
      const data = event.notification?.extra || event.notification?.data || {};
      if ((window as any).__ON_NOTIFICATION_ACTION) {
        (window as any).__ON_NOTIFICATION_ACTION({ actionId, data });
      }
    } catch (e) {
      console.warn('Error handling local notification action', e);
    }
  });
  nativeListenerInitialized = true;
};

const ensureNativeChannel = async (LocalNotifications: any) => {
  if (nativeChannelInitialized || !LocalNotifications?.createChannel) return;
  try {
    await LocalNotifications.createChannel({
      id: 'memora-reminders',
      name: 'Memora Reminders',
      description: 'Reminder notifications for Memora',
      importance: 5,
      visibility: 1,
      sound: 'remindernotification',
      vibration: true,
      lights: true,
    } as any);
  } catch (e) {
    console.warn('Failed to create native notification channel', e);
  } finally {
    nativeChannelInitialized = true;
  }
};

const requestPermission = async (): Promise<NotifyPermission> => {
  if (isNative) {
    try {
      const mod: any = await import('@capacitor/local-notifications');
      const LocalNotifications = mod.LocalNotifications || mod;
      if (LocalNotifications && typeof LocalNotifications.requestPermissions === 'function') {
        const result = await LocalNotifications.requestPermissions();
        const permission = result?.display || result?.notification || result;
        if (typeof permission === 'string') {
          return permission as NotifyPermission;
        }
        if (typeof permission === 'object' && 'display' in permission) {
          return (permission.display || 'denied') as NotifyPermission;
        }
        if (result && typeof result === 'object' && 'display' in result) {
          return (result.display || 'denied') as NotifyPermission;
        }
      }
      if (LocalNotifications && typeof LocalNotifications.requestPermission === 'function') {
        const granted = await LocalNotifications.requestPermission();
        if (typeof granted === 'object' && 'value' in granted) {
          return granted.value ? 'granted' : 'denied';
        }
        return granted ? 'granted' : 'denied';
      }
      if (LocalNotifications && typeof LocalNotifications.checkPermissions === 'function') {
        const result = await LocalNotifications.checkPermissions();
        const permission = result?.display || result?.notification || result;
        if (typeof permission === 'string') {
          return permission as NotifyPermission;
        }
      }
    } catch (e) {
      console.warn('Capacitor LocalNotifications requestPermission failed', e);
    }
  }

  // Web fallback
  if (typeof Notification !== 'undefined' && Notification.requestPermission) {
    const p = await Notification.requestPermission();
    return (p || 'default') as NotifyPermission;
  }

  return 'denied';
};

const schedule = async (opts: { id?: number; title: string; body?: string; scheduleAt?: Date; extra?: any }) => {
  if (isNative) {
    try {
      const mod: any = await import('@capacitor/local-notifications');
      const LocalNotifications = mod.LocalNotifications || mod;
      await ensureNativeActionListener(LocalNotifications);
      await ensureNativeChannel(LocalNotifications);

      const rawId = opts.id || Date.now();
      const notificationId = rawId % 2147483647;
      const notificationObj: any = {
        id: notificationId,
        title: opts.title,
        body: opts.body || '',
        extra: opts.extra || { reminderId: notificationId },
        android: {
          channelId: 'memora-reminders',
          ongoing: true,
          autoCancel: false,
          timeoutAfter: 5000,
          importance: 5,
          visibility: 1,
          priority: 2,
          showWhen: true,
        },
      };

      if (opts.scheduleAt) {
        notificationObj.schedule = { at: opts.scheduleAt };
      }

      const notifications: any[] = [notificationObj];

      try {
        await LocalNotifications.registerActionTypes({
          types: [
            {
              id: 'REMINDER_ACTIONS',
              actions: [
                { id: 'COMPLETE', title: 'Complete' },
                { id: 'SNOOZE', title: 'Snooze 5m' },
                { id: 'DISMISS', title: 'Dismiss' },
              ],
            },
          ],
        } as any);
        notifications[0].actionTypeId = 'REMINDER_ACTIONS';
      } catch (e) {
        console.warn('Failed to register native notification actions', e);
      }

      console.log('[localNotifications] Scheduling native notification:', JSON.stringify(notifications[0]));
      await LocalNotifications.schedule({ notifications } as any);
      console.log('[localNotifications] Native notification scheduled successfully');
      return true;
    } catch (e) {
      console.error('[localNotifications] Native schedule failed:', e);
    }
  }

  // Web fallback: immediate notification if permission granted
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const n: any = new Notification(opts.title, { body: opts.body, requireInteraction: true });
      return n;
    }
  } catch (e) {
    console.warn('Web Notification schedule failed', e);
  }

  return false;
};

const teardown = async () => {
  try {
    if (nativeActionListener && typeof nativeActionListener.remove === 'function') {
      await nativeActionListener.remove();
    }
  } catch (e) {
    console.warn('Failed to tear down native notification listener', e);
  } finally {
    nativeActionListener = null;
    nativeListenerInitialized = false;
    nativeChannelInitialized = false;
  }
};

export default { requestPermission, schedule, teardown, isNative };
