import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as cors from 'cors';
import { auth, db } from './firebase';

const corsHandler = cors({ origin: true });

export function withCors(handler: functions.RequestHandler): functions.RequestHandler {
  return (req, res) => corsHandler(req, res, () => handler(req, res));
}

export async function verifyIdToken(req: functions.Request): Promise<admin.auth.DecodedIdToken> {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) throw new Error('Unauthorized');
  return await auth.verifyIdToken(token);
}

export async function writeDoc(path: string, data: any): Promise<FirebaseFirestore.WriteResult> {
  return await db.doc(path).set(data, { merge: true });
}

export function logError(context: string, err: any) {
  functions.logger.error(context, err);
}
