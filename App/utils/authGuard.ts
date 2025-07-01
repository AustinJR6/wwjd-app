import { useAuthStore } from "@/state/authStore";
import { signOutAndRetry } from "@/services/authService";

/**
 * Ensure the user is authenticated and the uid matches if provided.
 * Returns the stored uid when valid, otherwise null.
 */
export async function ensureAuth(expectedUid?: string): Promise<string | null> {
  const { uid } = useAuthStore.getState();

  if (!uid) {
    console.warn("🚫 Firestore access blocked: missing auth");
    await signOutAndRetry();
    return null;
  }

  if (expectedUid && uid !== expectedUid) {
    console.warn("🚫 Firestore access blocked: uid mismatch");
    await signOutAndRetry();
    return null;
  }

  return uid;
}
