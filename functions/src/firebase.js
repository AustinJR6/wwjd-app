// functions/src/firebase.ts
import * as admin from 'firebase-admin';
if (!admin.apps.length) {
    admin.initializeApp();
}
// Export the Firestore instance
const db = admin.firestore();
// Export the Auth instance
const auth = admin.auth();
// (Optional) Export the Storage instance
const storage = admin.storage();
export { admin, db, auth, storage };
