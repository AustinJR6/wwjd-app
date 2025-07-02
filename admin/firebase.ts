import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

function initialize() {
  if (admin.apps.length) return;

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  const defaultCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  let serviceAccount: admin.ServiceAccount | undefined;

  if (serviceAccountEnv) {
    const resolved = path.resolve(serviceAccountEnv);
    if (fs.existsSync(resolved)) {
      serviceAccount = require(resolved);
    } else {
      try {
        serviceAccount = JSON.parse(serviceAccountEnv);
      } catch {
        console.warn('FIREBASE_SERVICE_ACCOUNT is not valid JSON or path');
      }
    }
  } else if (defaultCredPath && fs.existsSync(defaultCredPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(defaultCredPath, 'utf8'));
  }

  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    admin.initializeApp();
  }
}

initialize();

export const auth = admin.auth();
export const db = admin.firestore();
