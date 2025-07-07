import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// 🚨 Centralized user update function. All profile field changes must go through here.
export async function updateUserProfile(
  uidOrFields: string | Record<string, any>,
  maybeFields?: Record<string, any>,
) {
  const uid =
    typeof uidOrFields === "string" ? uidOrFields : auth.currentUser?.uid;
  const fields =
    typeof uidOrFields === "string" ? maybeFields || {} : uidOrFields;

  if (!uid) {
    console.warn("\u274C No UID available for user update.");
    return;
  }

  try {
    await setDoc(doc(db, "users", uid), fields, { merge: true });
    console.log("\u2705 Profile updated:", fields);
  } catch (error) {
    console.error("\uD83D\uDD25 Failed to update user profile:", error);
  }
}
