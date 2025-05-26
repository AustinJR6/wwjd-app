// App/hooks/useNotifications.ts (or wherever you schedule notifications)
import * as Notifications from 'expo-notifications';

// ... other code ...

const scheduleDailyNotification = async (hour: number, minute: number) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Your daily reminder!',
      body: 'Time to check in with WWJD.',
      // Add other content options like data, sound etc.
    },
    trigger: {
      // FIX: Add 'type: 'calendar'' to specify it's a calendar-based trigger
      type: 'calendar',
      hour: hour,
      minute: minute,
      repeats: true,
    },
  });
};

// ... rest of your file ...