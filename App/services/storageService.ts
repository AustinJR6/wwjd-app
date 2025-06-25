import { getAuthHeaders } from '@/config/firebaseApp';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

const BUCKET = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;

export async function uploadImage(fileUri: string, path: string): Promise<string> {
  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    console.warn('🚫 Storage upload without idToken');
    throw new Error('Missing auth token');
  }

  const response = await fetch(fileUri);
  const blob = await response.blob();
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=${encodeURIComponent(path)}`;

  const res = await sendRequestWithGusBugLogging(() =>
    fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'application/octet-stream', ...headers },
      body: blob,
    })
  );

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 403) {
      console.error('❌ Firestore permission error:', {
        url: uploadUrl,
        headers,
        response: errorText,
      });
    }
    throw new Error(errorText || 'Upload failed');
  }

  return getDownloadUrl(path);
}

export function getDownloadUrl(path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
}
