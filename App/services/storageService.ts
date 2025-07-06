import axios from 'axios';
import Constants from 'expo-constants';

export const STORAGE_BUCKET =
  Constants.expoConfig.extra.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
if (!STORAGE_BUCKET) {
  console.warn('⚠️ Missing EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET in .env');
}

export async function uploadImage(fileUri: string, path: string): Promise<string> {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const url = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`;
  const res = await axios.post(url, blob, {
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  const data = res.data;
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${data.downloadTokens}`;
}

export function getDownloadUrl(path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
}
