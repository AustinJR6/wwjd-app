import { useAuthStore } from "@/state/authStore";
import { signOutAndRetry } from "@/services/authService";

/**
 * Ensure the user is authenticated and the uid matches if provided.
 * Returns the stored uid when valid, otherwise null.
 */
export async function ensureAuth(expectedUid?: string): Promise<string | null> {
  const { uid, idToken, refreshIdToken } = useAuthStore.getState();

  if (!uid || !idToken) {
    console.warn("🚫 Firestore access blocked: missing auth");
    await signOutAndRetry();
    return null;
  }

  if (expectedUid && uid !== expectedUid) {
    console.warn("🚫 Firestore access blocked: uid mismatch");
    await signOutAndRetry();
    return null;
  }

  try {
    await refreshIdToken();
  } catch (err) {
    console.warn("Token refresh failed in authGuard", err);
  }

  return uid;
}
