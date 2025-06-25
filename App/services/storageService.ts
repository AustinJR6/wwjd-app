import { getAuthHeaders } from '@/config/firebaseApp';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import { signOutAndRetry, logTokenIssue } from '@/services/authService';

const BUCKET = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;

export async function uploadImage(fileUri: string, path: string): Promise<string> {
  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    await logTokenIssue('storage upload', false);
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
    console.warn(`❌ Firestore REST error on ${uploadUrl}:`, errorText);
    if (res.status === 403) {
      await signOutAndRetry();
      return '' as any;
    }
    throw new Error(errorText || 'Upload failed');
  }

  return getDownloadUrl(path);
}

export function getDownloadUrl(path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
}
