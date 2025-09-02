import { endpoints } from './endpoints';
import { getAuthHeaders } from '@/utils/authUtils';

export async function prepareUserContext(uid: string, userMessage: string): Promise<{
  profile: string;
  goals: string[];
  memories: string[];
  sessionSummary?: string;
  selectedMemoryIds?: string[];
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(endpoints.prepareUserContext, {
    method: 'POST',
    headers,
    body: JSON.stringify({ uid, userMessage }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'prepareUserContext failed');
  return data?.context || { profile: '', goals: [], memories: [], sessionSummary: '' };
}

export async function enqueueMemoryExtraction(uid: string, text: string, source: 'chat' | 'journal' | 'system' = 'chat') {
  try {
    const headers = await getAuthHeaders();
    // fire-and-forget
    fetch(endpoints.addMemoriesFromText, {
      method: 'POST',
      headers,
      body: JSON.stringify({ uid, text, source }),
    }).catch(() => {});
    if (__DEV__) console.log('🧠 Memory extraction enqueued', { len: text?.length || 0, source });
  } catch {}
}

export async function reinforceMemories(memoryIds: string[]): Promise<void> {
  const headers = await getAuthHeaders();
  await fetch(endpoints.reinforceMemories, {
    method: 'POST',
    headers,
    body: JSON.stringify({ memoryIds }),
  });
}
