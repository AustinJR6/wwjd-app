import { storageRef } from '../config/firebaseConfig.ts'; // Import aligned storage instance
import { getDownloadURL, ref, uploadBytes } from '@react-native-firebase/storage'; // Import functions from @react-native-firebase/storage

export async function uploadImage(fileUri: string, path: string): Promise<string> {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const imageRef = ref(storageRef, path); // Use storageRef instance

  await uploadBytes(imageRef, blob);
  return await getDownloadURL(imageRef);
}