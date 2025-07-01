import storage from '@react-native-firebase/storage';

export async function uploadImage(fileUri: string, path: string): Promise<string> {
  const ref = storage().ref(path);
  await ref.putFile(fileUri);
  return ref.getDownloadURL();
}

export function getDownloadUrl(path: string): Promise<string> {
  return storage().ref(path).getDownloadURL();
}
