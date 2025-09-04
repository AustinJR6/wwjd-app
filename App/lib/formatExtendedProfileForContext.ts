import { fetchExtendedProfile } from '@/lib/firestoreExtendedProfile';

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export async function formatExtendedProfileForContext(uid: string): Promise<string> {
  const p = await fetchExtendedProfile(uid);
  if (!p) return '';

  const parts: string[] = [];
  if (p.bio) parts.push(`Bio: ${truncate(p.bio, 400)}`);
  if (p.goals?.length) parts.push(`Goals: ${p.goals.slice(0, 10).join('; ')}`);
  if (p.dreams?.length) parts.push(`Dreams: ${p.dreams.slice(0, 10).join('; ')}`);
  if (p.beliefs?.length) parts.push(`Beliefs: ${p.beliefs.slice(0, 10).join('; ')}`);

  return parts.join(' | ');
}

