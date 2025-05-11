import * as Notifications from 'expo-notifications'

export async function scheduleDailyNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { hour: 8, minute: 0, repeats: true }
  })
}
