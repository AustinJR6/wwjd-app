import { Alert } from 'react-native';

const defaultMessages = [
  "Something interrupted the connection. Let’s try again soon.",
  "Even light flickers. We’ll reconnect shortly.",
];

export function showGracefulError(msg?: string) {
  const text = msg || defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
  Alert.alert('Oops', text);
}
