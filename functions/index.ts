import { onRequest } from "firebase-functions/v2/https";
import { auth, db } from "./firebase";
import * as admin from "firebase-admin";

export const incrementReligionPoints = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    res.status(401).send("Unauthorized – missing token");
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
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

    const ref = db.collection("religions").doc(religion);
    await db.runTransaction(async (t: FirebaseFirestore.Transaction) => {
      const snap = await t.get(ref);
      const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
      t.set(ref, { totalPoints: current + points }, { merge: true });
    });

    res.status(200).send({ message: "Points updated" });
  } catch (err: any) {
    console.error("🔥 Backend error:", err.message);
    res.status(500).send("Internal error");
  }
});

export const completeChallenge = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    res.status(401).send("Unauthorized");
    return;
  }

  try {
    const { userId, challengeId, religion, points } = req.body;

    if (!userId || !challengeId || !religion || typeof points !== "number") {
      res.status(400).send("Missing input fields");
      return;
    }

    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.uid !== userId) {
      res.status(403).send("Forbidden");
      return;
    }

    const ref = db.collection("completedChallenges").doc(userId);
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const data = snap.exists ? snap.data() : {};
      const list = Array.isArray(data?.challenges) ? data!.challenges : [];
      list.push({ id: challengeId, completedAt: Date.now() });
      t.set(ref, { challenges: list }, { merge: true });
    });

    await db.collection("users").doc(userId).set(
      {
        individualPoints: admin.firestore.FieldValue.increment(points),
        lastStreakDate: new Date().toISOString(),
      },
      { merge: true }
    );

    const relRef = db.collection("religions").doc(religion);
    await db.runTransaction(async (t) => {
      const snap = await t.get(relRef);
      const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
      t.set(relRef, { totalPoints: current + points }, { merge: true });
    });

    res.status(200).send({ message: "Challenge completed" });
  } catch (err: any) {
    console.error("🔥 completeChallenge error:", err.message);
    res.status(500).send("Internal error: " + err.message);
  }
});
