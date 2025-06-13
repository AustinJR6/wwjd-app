import { storage } from '@/config/firebase';

export async function uploadImage(fileUri: string, path: string): Promise<string> {
  const response = await fetch(fileUri);
  const blob = await response.blob();

  const imageRef = storage().ref(path);
  await imageRef.put(blob); // ✅ use .put instead of uploadBytes

  return await imageRef.getDownloadURL(); // ✅ access method on the reference
}

