import { Request } from 'express';
import { auth } from '@core/firebase';

export function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.split('Bearer ')[1];
}

export async function verifyIdToken(token: string) {
  return auth.verifyIdToken(token);
}
