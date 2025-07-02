import { Request, Response, NextFunction } from 'express';
import { auth } from '../admin/firebase';

export interface AuthedRequest extends Request {
  uid?: string;
}

export async function verifyFirebaseIdToken(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const idToken = header.split('Bearer ')[1];

  try {
    const decoded = await auth.verifyIdToken(idToken);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    console.error('Token verification failed', err);
    res.status(401).json({ error: 'Invalid ID token' });
  }
}
