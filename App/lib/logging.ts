export function logFirestoreError(operation: string, path: string, error: any) {
  const status = error?.response?.status ?? 'unknown';
  const msg =
    error?.response?.data?.error?.message ?? error.message ?? 'Unknown error';

  console.error(`🔥 Firestore ${operation} failed on ${path}`, {
    status,
    message: msg,
    response: error?.response?.data,
  });
}
