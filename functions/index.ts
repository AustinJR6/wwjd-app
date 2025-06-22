import { onRequest } from "firebase-functions/v2/https";
import { auth, db } from "./firebase";

export const incrementReligionPoints = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) return res.status(401).send("Unauthorized – missing token");

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const { religion, points } = req.body;

    if (
      typeof religion !== "string" ||
      typeof points !== "number" ||
      points <= 0 ||
      points > 100
    ) {
      return res.status(400).send("Invalid input.");
    }

    const ref = db.collection("religions").doc(religion);
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const current = snap.exists ? snap.data().totalPoints || 0 : 0;
      t.set(ref, { totalPoints: current + points }, { merge: true });
    });

    res.status(200).send({ message: "Points updated" });
  } catch (err: any) {
    console.error("🔥 Backend error:", err.message);
    res.status(500).send("Internal error");
  }
});
