import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { makeTitle } from '../functions/src/chatUtils';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

(async () => {
  const usersSnap = await db.collection('users').get();
  let migrated = 0;
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const chatsSnap = await db.collection(`users/${uid}/religionChats`).get();
    for (const chat of chatsSnap.docs) {
      const data = chat.data();
      const prompt = data.prompt || data.content || '';
      const response = data.response || '';
      const createdAt = data.createdAt || FieldValue.serverTimestamp();
        const threadId = uuidv4();
      const threadRef = db.doc(`users/${uid}/chats/threads/${threadId}`);
      await threadRef.set({
        title: makeTitle(prompt || 'Conversation'),
        createdAt,
        lastMessageAt: createdAt,
        messageCount: 2,
      }, { merge: true });
        await db.doc(`users/${uid}/chats/threads/${threadId}/messages/${uuidv4()}`).set({
        role: 'user',
        text: prompt,
        createdAt,
      });
        await db.doc(`users/${uid}/chats/threads/${threadId}/messages/${uuidv4()}`).set({
        role: 'assistant',
        text: response,
        createdAt,
      });
      await chat.ref.update({ migrated: true });
      migrated++;
    }
  }
  console.log(`Migrated ${migrated} chats.`);
})();
