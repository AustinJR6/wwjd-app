import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'reflectionReminderId';

export async function scheduleReflectionReminder(time: string) {
  const [hour, minute] = time.split(':').map((t) => parseInt(t, 10));
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'OneVine Reflection', body: randomMessage() },
    trigger: { hour, minute, repeats: true, type: 'daily' } as any,
  });
  await AsyncStorage.setItem(STORAGE_KEY, id);
}

export async function cancelReflectionReminder() {
  const id = await AsyncStorage.getItem(STORAGE_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(STORAGE_KEY);
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
