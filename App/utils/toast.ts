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

