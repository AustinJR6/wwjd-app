import { getStoredToken } from './authService';

const BUCKET = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;

export async function uploadImage(fileUri: string, path: string): Promise<string> {
  const idToken = await getStoredToken();
  if (!idToken) {
    console.warn('🚫 Storage upload without idToken');
    throw new Error('Missing auth token');
  }

  const response = await fetch(fileUri);
  const blob = await response.blob();
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=${encodeURIComponent(path)}`;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'application/octet-stream',
      Authorization: `Bearer ${idToken}`,
    },
    body: blob,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Upload failed');
  }

  return getDownloadUrl(path);
}

export function getDownloadUrl(path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
}
