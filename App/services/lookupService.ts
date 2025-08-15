import { listCollection } from '@/services/firestoreService';

export type Religion = { id: string; name: string };

export async function fetchReligions(): Promise<Religion[]> {
  const docs = await listCollection<Religion>('religions', 500);
  return docs
    .filter((r) => !!r?.id && !!r?.name)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}

export type Region = { id: string; name: string };

export async function fetchRegions(): Promise<Region[]> {
  const docs = await listCollection<Region>('regions', 100);
  return docs.filter((d) => d?.id && d?.name);
}
