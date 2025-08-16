import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { db } from '../../../firebase';
import { withCors, withHandler, jsonOk, jsonError } from '../../core/http';
import { Forbidden, NotFound } from '../../core/errors';
import { updateStreakAndXPInternal, validateSignupProfile } from '../../utils';

export const updateStreakAndXP = functions.https.onRequest(
  withCors(
    withHandler(async (_req: Request, res: Response, ctx) => {
      try {
        const type = _req.body?.type || 'general';
        await updateStreakAndXPInternal(ctx.uid!, type);
        jsonOk(res, { message: 'Streak updated' });
      } catch (err: any) {
        jsonError(res, err);
      }
    }, { auth: 'required' })
  )
);

export const getUserProfile = functions.https.onRequest(
  withCors(
    withHandler(async (req: Request, res: Response, ctx) => {
      const reqUid = typeof req.query.uid === 'string' ? (req.query.uid as string) : req.body?.uid || ctx.uid;
      if (reqUid !== ctx.uid) {
        throw new Forbidden('Forbidden');
      }
      const snap = await db.collection('users').doc(reqUid).get();
      if (!snap.exists) {
        throw new NotFound('Not found');
      }
      jsonOk(res, { uid: reqUid, ...snap.data() });
    }, { auth: 'required' })
  )
);

async function ensureDocument(path: string, data: Record<string, any>) {
  const ref = db.doc(path);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set(data, { merge: true });
  }
}

export const seedFirestore = functions.https.onRequest(
  withCors(
    withHandler(async (_req: Request, res: Response) => {
      try {
        await Promise.all([
          ensureDocument('users/seed-user', { initialized: true }),
          ensureDocument('subscriptions/seed-user', {
            active: false,
            tier: 'free',
            subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: null,
          }),
          ensureDocument('tokens/settings', {
            adRewardAmount: 2,
            freeAskCooldownHours: 24,
            freeSkipCooldownHours: 24,
            freeTokensOnSignup: 5,
            pricePerToken: 0.05,
          }),
          ensureDocument('tokens/seed-user', { tokens: 0 }),
          ensureDocument('challengeProofs/dummy', { initialized: true }),
          ensureDocument('freeAsk/seed-user', { initialized: true }),
          ensureDocument('dailyChallenges/dummy', { placeholder: true }),
          ensureDocument('activeChallenges/dummy', { placeholder: true }),
          ensureDocument('completedChallenges/dummy', { placeholder: true }),
          ensureDocument('religion/dummy', { name: 'Dummy Religion' }),
          ensureDocument('organizations/dummy', { name: 'Dummy Org' }),
          ensureDocument('regions/southwest', {
            id: 'southwest',
            name: 'Southwest',
            code: 'SW',
            sortOrder: 1,
          }),
          ensureDocument('regions/northeast', {
            id: 'northeast',
            name: 'Northeast',
            code: 'NE',
            sortOrder: 2,
          }),
          ensureDocument('regions/midwest', {
            id: 'midwest',
            name: 'Midwest',
            code: 'MW',
            sortOrder: 3,
          }),
          ensureDocument('regions/southeast', {
            id: 'southeast',
            name: 'Southeast',
            code: 'SE',
            sortOrder: 4,
          }),
          ensureDocument('regions/northwest', {
            id: 'northwest',
            name: 'Northwest',
            code: 'NW',
            sortOrder: 5,
          }),
        ]);
        jsonOk(res, { message: 'Firestore seeded' });
      } catch (err: any) {
        jsonError(res, err);
      }
    })
  )
);

// The following functions are placeholders from original file and may need further refactor
export const backfillUserProfiles = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  // TODO: implement or move to service layer
  return { processed: 0, updated: 0 };
});

export const updateUserProfileCallable = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  // TODO: implement
  return { success: true };
});

async function completeSignupAndProfileCore({
  uid,
  body,
}: {
  uid: string;
  body: any;
}) {
  if (!validateSignupProfile(body)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid profile');
  }
  await db.collection('users').doc(uid).set(body, { merge: true });
  return { message: 'Profile updated' };
}

export const completeSignupAndProfile = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required'
      );
    }
    try {
      return await completeSignupAndProfileCore({
        uid: context.auth.uid,
        body: data,
      });
    } catch (err: any) {
      throw new functions.https.HttpsError(
        'unknown',
        err?.message || 'Failed to update profile'
      );
    }
  }
);
