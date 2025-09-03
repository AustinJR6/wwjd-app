import { Alert, Platform, ToastAndroid } from 'react-native';

// Simple cross-platform toast helper
// Android: ToastAndroid; iOS: Alert.alert
export function showToast(title: string, message?: string) {
  if (Platform.OS === 'android') {
    const text = message ? `${title}: ${message}` : title;
    ToastAndroid.show(text, ToastAndroid.SHORT);
  } else {
    Alert.alert(title, message);
  }
}

// Tiny convenience helper used across the app
// Shows a short toast on Android and an alert on iOS
export function toast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert('', msg);
  }
}

