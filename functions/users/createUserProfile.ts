import * as functions from 'firebase-functions/v1';
import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { db, auth } from '../firebase';
import { withCors, verifyAuth } from '../helpers';
import { UserProfile } from '../types/UserProfile';

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
        const userRecord = await auth.getUser(uid);
        const userRef = db.collection('users').doc(uid);
        const now = admin.firestore.FieldValue.serverTimestamp();
        const defaults: UserProfile = {
          uid,
          email: userRecord.email || '',
          emailVerified: userRecord.emailVerified || false,
          displayName: userRecord.displayName || 'New User',
          createdAt: now as any,
          lastActive: now as any,
          lastFreeAsk: now as any,
          lastFreeSkip: now as any,
          onboardingComplete: false,
          religion: 'SpiritGuide',
          tokens: 5,
          skipTokensUsed: 0,
          individualPoints: 0,
          isSubscribed: false,
          nightModeEnabled: false,
          preferredName: null,
          pronouns: null,
          avatarURL: null,
          profileComplete: false,
          profileSchemaVersion: 'v1',
          challengeStreak: { count: 0, lastCompletedDate: null },
          dailyChallengeCount: 0,
          dailySkipCount: 0,
          lastChallengeLoadDate: null,
          lastSkipDate: null,
        };

        const snapshot = await userRef.get();
        const toPatch: Partial<UserProfile> = {};
        if (!snapshot.exists) {
          Object.assign(toPatch, defaults);
        } else {
          const existing = snapshot.data() as Partial<UserProfile>;
          for (const [key, value] of Object.entries(defaults)) {
            const current = (existing as any)[key];
            if (current === undefined || current === null) {
              (toPatch as any)[key] = value;
            }
          }
          toPatch.lastActive = now as any;
        }

        if (Object.keys(toPatch).length) {
          await userRef.set(toPatch, { merge: true });
        }

        const finalSnap = await userRef.get();
        res.status(200).json(finalSnap.data());
      } catch (err: any) {
        console.error('createUserProfile error', err);
        res.status(500).json({ error: err.message || 'Failed to create profile' });
      }
    })
  );
