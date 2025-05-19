import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

export async function uploadImage(fileUri: string, path: string): Promise<string> {
  const { storage } = await import('../config/firebaseConfig'); // ✅ Safe dynamic import

  const response = await fetch(fileUri);
  const blob = await response.blob();
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, blob);
  return await getDownloadURL(storageRef);
}
