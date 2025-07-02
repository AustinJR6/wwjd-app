export const STORAGE_BUCKET = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '';

export async function uploadImage(fileUri: string, path: string): Promise<string> {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const url = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
  const data = await res.json();
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${data.downloadTokens}`;
}

export function getDownloadUrl(path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
}
