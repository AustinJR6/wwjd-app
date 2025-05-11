import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../config/firebaseConfig'

export async function uploadImage(fileUri: string, path: string): Promise<string> {
  const response = await fetch(fileUri)
  const blob = await response.blob()
  const storageRef = ref(storage, path)

  await uploadBytes(storageRef, blob)
  return await getDownloadURL(storageRef)
}
