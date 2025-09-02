import { useRef } from 'react';

export type SessionMessage = { role: 'user'|'assistant'|'system'; content: string; ts: number };

export function useSessionContext() {
  const messagesRef = useRef<SessionMessage[]>([]);
  return {
    append(msg: { role: 'user'|'assistant'|'system'; content: string }) {
      messagesRef.current.push({ ...msg, ts: Date.now() });
    },
    clear() { messagesRef.current = []; },
    all() { return messagesRef.current.slice(); },
    toPlainText() { return messagesRef.current.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n'); }
  };
}
