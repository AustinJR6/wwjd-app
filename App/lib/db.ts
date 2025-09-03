import { doc, setDoc, serverTimestamp, collection, runTransaction, getFirestore, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

const db = getFirestore();

export type ThreadMeta = {
  title: string;
  createdAt: Timestamp | null;
  lastMessageAt: Timestamp | null;
  messageCount: number;
  model: string;
  systemPromptVersion: string;
  saved?: boolean;
  summary?: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  text: string;
  tokens?: number;
  createdAt: Timestamp | null;
  ctxSnapshotRefs?: { memories?: string[]; goals?: string[] };
};

export function makeTitle(text: string) {
  return (text || '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join(' ') || 'New Conversation';
}

// /users/{uid}/chats/threads/{threadId}
export async function createThread(uid: string, firstUserText: string, meta: Partial<ThreadMeta> = {}) {
  const threadId = uuidv4();
  const threadRef = doc(db, 'users', uid, 'chats', 'threads', threadId);
  const base: ThreadMeta = {
    title: makeTitle(firstUserText),
    createdAt: null,
    lastMessageAt: null,
    messageCount: 0,
    model: meta.model ?? 'gemini-1.5',
    systemPromptVersion: meta.systemPromptVersion ?? 'v1',
    saved: false,
    summary: '',
  };
  await setDoc(threadRef, { ...base, createdAt: serverTimestamp(), lastMessageAt: serverTimestamp() });
  return { threadId, threadRef };
}

// /users/{uid}/chats/threads/{threadId}/messages/{messageId}
export async function appendMessage(uid: string, threadId: string, msg: Omit<ChatMessage, 'createdAt'>) {
  const messageId = uuidv4();
  const threadRef = doc(db, 'users', uid, 'chats', 'threads', threadId);
  const messagesCol = collection(threadRef, 'messages');
  const messageRef = doc(messagesCol, messageId);
  await runTransaction(db, async (tx) => {
    tx.set(messageRef, { ...msg, createdAt: serverTimestamp() });
    const snap = await tx.get(threadRef);
    const nextCount = (snap.exists() ? (snap.data().messageCount || 0) : 0) + 1;
    tx.update(threadRef, { messageCount: nextCount, lastMessageAt: serverTimestamp() });
  });
  return messageId;
}

export async function markThreadSaved(uid: string, threadId: string, summary: string) {
  const ref = doc(db, 'users', uid, 'chats', 'threads', threadId);
  await setDoc(ref, { saved: true, summary }, { merge: true });
}

