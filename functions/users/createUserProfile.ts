import * as functions from 'firebase-functions/v1';
import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { db, auth } from '../firebase';
import { withCors, verifyAuth } from '../helpers';

export const createUserProfile = functions
  .region('us-central1')
  .https.onRequest(
    withCors(async (req: Request, res: Response) => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }

      const { uid } = req.body || {};
      if (!uid) {
        res.status(400).json({ error: 'Missing uid' });
        return;
      }

      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (authData.uid !== uid) {
        console.warn('UID mismatch', { tokenUid: authData.uid, uid });
      }

      try {
        const user = await auth.getUser(uid);
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        const profile = {
          email: user.email || '',
          displayName: user.displayName || 'New User',
          emailVerified: user.emailVerified || false,
          onboardingComplete: false,
          religion: 'SpiritGuide',
          tokens: 0,
          createdAt: timestamp,
          lastActive: timestamp,
          preferredName: '',
          pronouns: '',
          avatarURL: '',
          profileComplete: false,
          profileSchemaVersion: 'v1',
        };

        await db.collection('users').doc(uid).set(profile, { merge: true });
        const snap = await db.collection('users').doc(uid).get();
        res.status(200).json({ uid, ...(snap.data() || profile) });
      } catch (err: any) {
        console.error('createUserProfile error', err);
        res.status(500).json({ error: err.message || 'Failed to create profile' });
      }
    })
  );
