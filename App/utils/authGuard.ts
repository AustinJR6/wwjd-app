import { useAuthStore } from "@/state/authStore";
import { signOutAndRetry } from "@/services/authService";

/**
 * Ensure the user is authenticated and the uid matches if provided.
 * Returns the stored uid when valid, otherwise null.
 */
export async function ensureAuth(expectedUid?: string | null): Promise<string> {
  const { uid } = useAuthStore.getState();

  if (!uid) {
    console.warn("🚫 Firestore access blocked: missing auth");
    await signOutAndRetry();
    throw new Error("Unauthorized – No user ID.");
  }

  if (expectedUid && uid !== expectedUid) {
    console.warn("🚫 Firestore access blocked: uid mismatch");
    await signOutAndRetry();
    throw new Error("Unauthorized – No user ID.");
  }

  return uid;
}
