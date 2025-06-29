import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

export async function scheduleDailyNotification(title: string, body: string) {
  if (isExpoGo) {
    console.warn('⚠️ Running in Expo Go. Notification behavior may be limited.');
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: 'calendar',
        hour: 8,
        minute: 0,
        repeats: true
      } as any // ✅ cast to bypass incorrect type
    });
  } catch (err) {
    console.warn('Failed to schedule daily notification', err);
  }
}
