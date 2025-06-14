import { storage } from '@/config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export async function uploadImage(fileUri: string, path: string): Promise<string> {
  const response = await fetch(fileUri);
  const blob = await response.blob();

  const imageRef = ref(storage, path);
  await uploadBytes(imageRef, blob);

  return await getDownloadURL(imageRef);
}

