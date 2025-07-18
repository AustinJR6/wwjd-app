import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const canUseNotifications = Constants.appOwnership !== 'expo';

const STORAGE_KEY = 'reflectionReminderId';

export async function scheduleReflectionReminder(time: string) {
  if (!canUseNotifications) {
    console.warn('⚠️ Push notifications disabled in Expo Go.');
    return;
  }
  try {
    const [hour, minute] = time.split(':').map((t) => parseInt(t, 10));
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'OneVine Reflection', body: randomMessage() },
      trigger: { hour, minute, repeats: true, type: 'daily' } as any,
    });
    await AsyncStorage.setItem(STORAGE_KEY, id);
  } catch (err) {
    console.warn('Failed to schedule notification', err);
  }
}

export async function cancelReflectionReminder() {
  if (!canUseNotifications) {
    console.warn('⚠️ Push notifications disabled in Expo Go.');
    return;
  }
  try {
    const id = await AsyncStorage.getItem(STORAGE_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to cancel notification', err);
  }
}

const messages = [
  'How did you grow today?',
  'What challenged your spirit?',
  'Pause. Reflect. Breathe.',
];

function randomMessage() {
  return messages[Math.floor(Math.random() * messages.length)];
}
