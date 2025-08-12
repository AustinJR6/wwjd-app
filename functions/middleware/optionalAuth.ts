import * as admin from 'firebase-admin';
import { Request, Response, NextFunction } from 'express';

export async function optionalAuth(req: Request & { user?: admin.auth.DecodedIdToken }, res: Response, next: NextFunction) {
  try {
    const hdr = req.headers.authorization || '';
    const m = hdr.match(/^Bearer (.+)$/i);
    if (m) {
      req.user = await admin.auth().verifyIdToken(m[1]);
    }
  } catch {
    // ignore decode errors, proceed unauthenticated
  }
  next();
}
