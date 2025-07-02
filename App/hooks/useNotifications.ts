import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const isDevClient = !Constants.appOwnership || Constants.appOwnership === 'expo-dev-client';

export async function scheduleDailyNotification(title: string, body: string) {
  if (!isDevClient) {
    console.warn('⚠️ Push notifications disabled in Expo Go.');
    return;
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
