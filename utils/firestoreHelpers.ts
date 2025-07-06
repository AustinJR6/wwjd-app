import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export async function updateUserProfile(fields: Record<string, any>) {
  const uid = auth.currentUser?.uid;
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
