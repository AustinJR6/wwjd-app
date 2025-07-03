import { Alert } from 'react-native';

const defaultMessages = [
  'Unable to load response — please check your internet or try again later',
  "Something interrupted the connection. Let’s try again soon.",
  "Even light flickers. We’ll reconnect shortly.",
];

export function showGracefulError(msg?: string) {
  const text = msg || defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
  Alert.alert('Oops', text);
}

export function showPermissionDenied(msg = 'You do not have permission to perform this action.') {
  Alert.alert('Access Denied', msg);
}

export function showPermissionDeniedForPath(path: string) {
  console.warn('🔥 Firestore permission denied for path', path);
  showPermissionDenied(`Permission denied for ${path}`);
}
