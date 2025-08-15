import * as functions from 'firebase-functions/v1';
import { Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { withCors, verifyIdToken, logError } from '../helpers';
import { db } from '../firebase';

export const incrementReligionPoints = functions
  .https.onRequest(
    withCors(async (req: Request, res: Response) => {
      try {
        const { uid } = await verifyIdToken(req);
        const { religion, points } = req.body;

        if (
          typeof religion !== "string" ||
          typeof points !== "number" ||
          points <= 0 ||
          points > 100
        ) {
          res.status(400).send("Invalid input.");
          return;
        }

        const ref = db.collection("religion").doc(religion);
        logger.info("🛠 Updating religion doc with merge", { religion });
        await db.runTransaction(async (t: FirebaseFirestore.Transaction) => {
          const snap = await t.get(ref);
          const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
          t.set(ref, { totalPoints: current + points }, { merge: true });
        });
        logger.info("✅ Religion updated", { religion });

        res.status(200).send({ message: "Points updated" });
      } catch (err: any) {
        logError("incrementReligionPoints", err);
        const code = err.message === "Unauthorized" ? 401 : 500;
        res.status(code).json({ error: err.message });
      }
    })
  );

export const awardPointsToUser = functions
  .https.onRequest(
    withCors(async (req: Request, res: Response) => {
      try {
        const { uid } = await verifyIdToken(req);
        const { points } = req.body;

        if (typeof points !== "number" || points <= 0 || points > 100) {
          res.status(400).send("Invalid input.");
          return;
        }

        const userSnap = await db.doc(`users/${uid}`).get();
        if (!userSnap.exists) {
          res.status(404).send("User not found");
          return;
        }
        const userData = userSnap.data() || {};
        const religionId = userData?.religion ?? "SpiritGuide";
        const organizationId = userData.organizationId;

        await db.runTransaction(async (t) => {
          if (religionId) {
            const ref = db.doc(`religion/${religionId}`);
            logger.info("🛠 Updating religion doc with merge", { religionId });
            const snap = await t.get(ref);
            const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
            t.set(ref, { name: religionId, totalPoints: current + points }, { merge: true });
            logger.info("✅ Religion updated", { religionId });
          }
          if (organizationId) {
            const ref = db.doc(`organizations/${organizationId}`);
            logger.info("🛠 Updating organization doc with merge", { organizationId });
            const snap = await t.get(ref);
            const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
            t.set(ref, { name: organizationId, totalPoints: current + points }, { merge: true });
            logger.info("✅ Organization updated", { organizationId });
          }
        });

        res.status(200).send({ message: "Points awarded" });
      } catch (err: any) {
        logError("awardPointsToUser", err);
        const code = err.message === "Unauthorized" ? 401 : 500;
        res.status(code).json({ error: err.message });
      }
    })
  );
