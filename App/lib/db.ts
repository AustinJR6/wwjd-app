import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  increment,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import Constants from 'expo-constants';
import { ulid } from 'ulid';

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_MSG_SENDER_ID,
  appId: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const db = getFirestore();

export type ThreadMeta = {
  title: string;
  createdAt: Timestamp | null;
  lastMessageAt: Timestamp | null;
  messageCount: number;
  model: string;
  systemPromptVersion: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  text: string;
  tokens?: number;
  createdAt: Timestamp | null;
  ctxSnapshotRefs?: { memories?: string[]; goals?: string[] };
};

const threadsCol = (uid: string) => collection(db, 'users', uid, 'chats', 'threads');
const messagesCol = (uid: string, threadId: string) =>
  collection(db, 'users', uid, 'chats', 'threads', threadId, 'messages');

function summarizeTitle(text: string) {
  const cleaned = text
    .replace(/["'`\*\_~#\-:;!?,.()/\[\]\{\}\|<>@\$%^&+=]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join(' ');
  return cleaned || 'New Conversation';
}

export async function createThread(
  uid: string,
  firstUserText: string,
  meta: Partial<ThreadMeta> = {},
) {
  const threadId = ulid();
  const threadRef = doc(threadsCol(uid), threadId);
  const data: ThreadMeta = {
    title: summarizeTitle(firstUserText),
    createdAt: serverTimestamp() as any,
    lastMessageAt: serverTimestamp() as any,
    messageCount: 0,
    model: meta.model || 'gemini-1.5-pro',
    systemPromptVersion: meta.systemPromptVersion || '1',
  };
  await setDoc(threadRef, data);
  return threadId;
}

export async function appendMessage(
  uid: string,
  threadId: string,
  msg: ChatMessage,
) {
  const messageId = ulid();
  const msgRef = doc(messagesCol(uid, threadId), messageId);
  await setDoc(msgRef, { ...msg, createdAt: serverTimestamp() });
  const threadRef = doc(threadsCol(uid), threadId);
  await runTransaction(db, async (tx) => {
    tx.update(threadRef, {
      messageCount: increment(1),
      lastMessageAt: serverTimestamp(),
    });
  });
  return messageId;
}

export async function exportThread(
  uid: string,
  threadId: string,
  summary: string = '',
) {
  const threadRef = doc(threadsCol(uid), threadId);
  await updateDoc(threadRef, {
    saved: true,
    summary: summary.slice(0, 200),
  });
}

export async function markMemoriesUsed(
  uid: string,
  memoryIds: string[],
) {
  if (!memoryIds.length) return;
  const batch = writeBatch(db);
  const now = serverTimestamp();
  for (const id of memoryIds) {
    const ref = doc(db, 'users', uid, 'memories', id);
    batch.update(ref, { lastUsedAt: now });
  }
  await batch.commit();
}

export default db;
