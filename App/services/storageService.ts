import { storageRef } from "@/config/firebaseConfig"; // aligned @react-native-firebase/storage instance

export async function uploadImage(fileUri: string, path: string): Promise<string> {
  const response = await fetch(fileUri);
  const blob = await response.blob();

  const imageRef = storageRef().ref(path); // ✅ use .ref on the instance
  await imageRef.put(blob); // ✅ use .put instead of uploadBytes

  return await imageRef.getDownloadURL(); // ✅ access method on the reference
}

