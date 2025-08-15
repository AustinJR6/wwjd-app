import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebase';
import {
  withCors,
  verifyAuth,
  extractAuthToken,
  logError,
} from '../helpers';
import {
  updateStreakAndXPInternal,
  validateSignupProfile,
  logTokenVerificationError,
  CURRENT_PROFILE_SCHEMA,
} from './utils';

export const updateStreakAndXP = functions
  .https.onRequest(
    withCors(async (req: Request, res: Response) => {
      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        logTokenVerificationError("updateStreakAndXP", extractAuthToken(req), err);
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      try {
        const type = req.body?.type || "general";
        await updateStreakAndXPInternal(authData.uid, type);
        res.status(200).json({ message: "Streak updated" });
      } catch (err: any) {
        logError("updateStreakAndXP", err);
        res.status(500).json({ error: err.message || "Failed" });
      }
    }),
  );

export const getUserProfile = functions
  .https.onRequest(
    withCors(async (req: Request, res: Response) => {
      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        logTokenVerificationError("getUserProfile", extractAuthToken(req), err);
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const reqUid =
        typeof req.query.uid === "string"
          ? (req.query.uid as string)
          : req.body?.uid || authData.uid;

      if (reqUid !== authData.uid) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      try {
        const snap = await db.collection("users").doc(reqUid).get();
        if (!snap.exists) {
          res.status(404).json({ error: "Not found" });
          return;
        }
        res.status(200).json({ uid: reqUid, ...snap.data() });
      } catch (err: any) {
        logError("getUserProfile", err);
        res.status(500).json({ error: err.message || "Failed" });
      }
    })
  );

async function ensureDocument(
  path: string,
  data: Record<string, any>,
) {
  const ref = db.doc(path);
  const snap = await ref.get();
  if (!snap.exists) {
    logger.info("🛠 Creating doc with merge", { path });
    await ref.set(data, { merge: true });
    logger.info("✅ Doc ensured", { path });
  }
}

export const seedFirestore = functions
  .https.onRequest(async (_req: Request, res: Response) => {
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

    res.status(200).json({ message: 'Firestore seeded' });
  } catch (err: any) {
    logger.error('seedFirestore error', err);
    res.status(500).json({ error: err.message || 'Failed' });
  }
});

export const backfillUserProfiles = functions.https.onCall(
  async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication required",
      );
    }

    let processed = 0;
    let updated = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    const batchSize = 500;

    const isMissing = (v: any) => v === undefined || v === null;
    const isMissingString = (v: any) =>
      isMissing(v) || (typeof v === "string" && v.trim() === "");

    while (true) {
      let query = db
        .collection("users")
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(batchSize);
      if (lastDoc) query = query.startAfter(lastDoc);

      const snap = await query.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        const data = doc.data() as Record<string, any>;
        const updates: Record<string, any> = {};

        const serverTs = admin.firestore.FieldValue.serverTimestamp() as any;

        if (isMissingString(data.email)) updates.email = "";
        if (typeof data.isSubscribed !== "boolean") updates.isSubscribed = false;
        if (isMissing(data.createdAt)) updates.createdAt = serverTs;
        if (!data.challengeStreak)
          updates.challengeStreak = { count: 0, lastCompletedDate: null };
        if (typeof data.dailyChallengeCount !== "number")
          updates.dailyChallengeCount = 0;
        if (typeof data.dailySkipCount !== "number")
          updates.dailySkipCount = 0;
        if (!("lastChallengeLoadDate" in data)) updates.lastChallengeLoadDate = null;
        if (!("lastSkipDate" in data)) updates.lastSkipDate = null;
        if (typeof data.skipTokensUsed !== "number") updates.skipTokensUsed = 0;
        if (typeof data.nightModeEnabled !== "boolean")
          updates.nightModeEnabled = false;
        updates.profileComplete = true;
        if (typeof data.profileSchemaVersion !== "number")
          updates.profileSchemaVersion = 1;
        if (isMissing(data.lastActive)) updates.lastActive = serverTs;
        if (isMissingString(data.religionPrefix)) updates.religionPrefix = "";
        if (isMissingString((data as any).organizationId))
          (updates as any).organizationId = null;
        if (isMissingString(data.preferredName)) updates.preferredName = "";
        if (isMissingString(data.pronouns)) updates.pronouns = "";
        if (isMissingString(data.avatarURL)) updates.avatarURL = "";
        if (isMissingString(data.displayName)) updates.displayName = "";
        if (isMissingString(data.username)) updates.username = "";
        if (isMissingString(data.region)) updates.region = "";
        if (isMissingString(data.religion)) updates.religion = "SpiritGuide";
        if (typeof data.tokens !== "number") updates.tokens = 0;
        if (typeof data.individualPoints !== "number") updates.individualPoints = 0;
        updates.onboardingComplete = true;
        if (!("organization" in data)) (updates as any).organization = null;

        if (Object.keys(updates).length) {
          logger.info(`Backfilling user ${doc.id}`, updates);
          await doc.ref.set(updates, { merge: true });
          updated++;
        } else {
          logger.info(`No updates needed for ${doc.id}`);
        }

        processed++;
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < batchSize) break;
    }

    logger.info(`Backfill complete`, { processed, updated });
    return { processed, updated };
  });

export const updateUserProfileCallable = functions.https.onCall(
  async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication required",
      );
    }

    const uid: string | undefined = data?.uid || context.auth.uid;
    const fields = data?.fields || {};

    if (!uid) {
      throw new functions.https.HttpsError("invalid-argument", "Missing uid");
    }
    if (typeof fields !== "object" || Array.isArray(fields)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "fields must be an object",
      );
    }

    const docRef = admin.firestore().collection("users").doc(uid);
    logger.info(`updateUserProfileCallable`, { uid, fields });
    try {
      await docRef.set(fields, { merge: true });
      return { success: true };
    } catch (err: any) {
      logger.error(`updateUserProfileCallable failed for ${uid}`, err);
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Update failed",
      );
    }
  });

export const completeSignupAndProfile = functions.https.onCall(
  async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication required",
      );
    }

    const uid: string | undefined = data?.uid;
    const rawProfile = data?.profile || {};

    if (!uid || uid !== context.auth.uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "UID mismatch",
      );
    }

    const profile = validateSignupProfile(rawProfile);

    const existing = await admin
      .firestore()
      .collection("users")
      .where("username", "==", profile.username)
      .limit(1)
      .get();
    if (!existing.empty && existing.docs[0].id !== uid) {
      throw new functions.https.HttpsError(
        "already-exists",
        "Username already taken",
      );
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const defaultProfile = {
      uid,
      email: profile.email,
      emailVerified: false,
      displayName: profile.displayName || profile.username,
      username: profile.username,
      region: profile.region || "",
      createdAt: timestamp,
      lastActive: timestamp,
      lastFreeAsk: timestamp,
      lastFreeSkip: timestamp,
      onboardingComplete: true,
      religion: profile.religion,
      tokens: 0,
      skipTokensUsed: 0,
      individualPoints: 0,
      isSubscribed: false,
      nightModeEnabled: false,
      preferredName: profile.preferredName,
      pronouns: profile.pronouns,
      avatarURL: profile.avatarURL,
      profileComplete: true,
      profileSchemaVersion: CURRENT_PROFILE_SCHEMA,
      challengeStreak: { count: 0, lastCompletedDate: null },
      dailyChallengeCount: 0,
      dailySkipCount: 0,
      lastChallengeLoadDate: null,
      lastSkipDate: null,
      organization: profile.organization ?? null,
      organizationId: null,
      religionPrefix: "",
    };

    const docRef = admin.firestore().collection("users").doc(uid);
    logger.info(`completeSignupAndProfile`, { uid, profile: defaultProfile });
    try {
      await docRef.set(defaultProfile, { merge: true });
      return { success: true };
    } catch (err: any) {
      logger.error(`completeSignupAndProfile failed for ${uid}`, err);
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Profile creation failed",
      );
    }
  });
