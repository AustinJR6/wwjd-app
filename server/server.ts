import express from 'express';
import { auth, db } from '../admin/firebase';
import { verifyFirebaseIdToken, AuthedRequest } from '../middleware/auth';
import { incrementUserReligionOrgPoints } from './leaderboard';

const app = express();
app.use(express.json());

app.post('/auth/verify', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken required' });
  try {
    const decoded = await auth.verifyIdToken(idToken);
    res.json({ uid: decoded.uid, decoded });
  } catch (err) {
    console.error('ID token verification failed', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/auth/custom', async (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'uid required' });
  try {
    const token = await auth.createCustomToken(uid);
    res.json({ token });
  } catch (err) {
    console.error('Create custom token failed', err);
    res.status(500).json({ error: 'Failed to create custom token' });
  }
});

app.get('/user/:uid', verifyFirebaseIdToken, async (req: AuthedRequest, res) => {
  try {
    const snap = await db.collection('users').doc(req.params.uid).get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(snap.data());
  } catch (err) {
    console.error('getUser failed', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.post('/journal', verifyFirebaseIdToken, async (req: AuthedRequest, res) => {
  const uid = req.uid!;
  try {
    const ref = await db
      .collection('journalEntries')
      .doc(uid)
      .collection('entries')
      .add({ ...req.body, createdAt: new Date() });
    res.json({ id: ref.id });
  } catch (err) {
    console.error('saveJournalEntry failed', err);
    res.status(500).json({ error: 'Failed to save entry' });
  }
});

app.post('/leaderboard/:uid/points', verifyFirebaseIdToken, async (req: AuthedRequest, res) => {
  const { uid } = req.params;
  if (req.uid !== uid) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const { points } = req.body;
  if (typeof points !== 'number' || points <= 0) {
    return res.status(400).json({ error: 'Invalid points' });
  }
  try {
    await incrementUserReligionOrgPoints(uid, points);
    res.json({ success: true });
  } catch (err) {
    console.error('incrementUserReligionOrgPoints failed', err);
    res.status(500).json({ error: 'Failed to update points' });
  }
});

app.patch('/users/:uid', verifyFirebaseIdToken, async (req: AuthedRequest, res) => {
  const { uid } = req.params;
  if (req.uid !== uid) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { religionId, religionSlug, ...fields } = req.body || {};
  try {
    let relId = religionId as string | undefined;
    if (!relId && religionSlug) {
      const q = await db.collection('religions').where('slug', '==', religionSlug).limit(1).get();
      if (!q.empty) {
        relId = q.docs[0].id;
      }
    }
    if (relId) {
      fields.religionRef = db.doc(`religions/${relId}`);
      fields.religion = relId;
    }

    await db.collection('users').doc(uid).set(fields, { merge: true });
    res.json({ success: true });
  } catch (err) {
    console.error('update user failed', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default app;
