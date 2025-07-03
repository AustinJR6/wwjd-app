import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import cors from 'cors';
import { Request, Response } from 'express';
import { auth, db } from './firebase';

const corsHandler = cors({ origin: true });

export function withCors(handler: (req: Request, res: Response) => void): (req: Request, res: Response) => void {
  return (req, res) => corsHandler(req, res, () => handler(req, res));
}

export async function verifyIdToken(req: Request): Promise<admin.auth.DecodedIdToken> {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) throw new Error('Unauthorized');
  return await auth.verifyIdToken(token);
}

export function extractAuthToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.split('Bearer ')[1];
}

export async function verifyAuth(req: Request): Promise<{ uid: string; token: string }> {
  const token = extractAuthToken(req);
  if (!token) {
    throw new Error('Missing Authorization header');
  }
  const decoded = await auth.verifyIdToken(token);
  return { uid: decoded.uid, token };
}

export async function writeDoc(path: string, data: any): Promise<FirebaseFirestore.WriteResult> {
  return await db.doc(path).set(data, { merge: true });
}

export function logError(context: string, err: any) {
  functions.logger.error(context, err);
}
