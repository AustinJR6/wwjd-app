import { queryCollection } from '@/services/firestoreService';

export type Religion = { id: string; name: string; order?: number };

export async function fetchReligions(): Promise<Religion[]> {
  try {
    const docs = await queryCollection<Religion>('religions', {
      orderByField: 'order',
      direction: 'ASCENDING',
      limit: 500,
    });
    const list = Array.isArray(docs) ? docs : [];
    return list.sort((a, b) => {
      const ao = a.order ?? 999999;
      const bo = b.order ?? 999999;
      if (ao !== bo) return ao - bo;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  } catch (err) {
    console.warn('Failed to fetch religions', err);
    return [];
  }
}
