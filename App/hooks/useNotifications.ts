import * as Notifications from 'expo-notifications';

export async function scheduleDailyNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: 'calendar',
      hour: 8,
      minute: 0,
      repeats: true
    } as any // ✅ cast to bypass incorrect type
  });
}
