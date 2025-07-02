import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

function initialize() {
  if (admin.apps.length) return;

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (credPath && fs.existsSync(credPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return;
  }

  if (credJson) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(credJson)),
    });
    return;
  }

  admin.initializeApp();
}

initialize();

export const auth = admin.auth();
export const db = admin.firestore();
