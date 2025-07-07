import { MockFirestore } from './firestoreMock';

jest.mock('../../admin/firebase', () => {
  const mockDb = new MockFirestore();
  return { db: mockDb };
});

import { incrementUserReligionOrgPoints } from '../leaderboard';
import { db } from '../../admin/firebase';

type MDB = MockFirestore & typeof db;
const mockDb = db as MDB;

beforeEach(() => {
  // reset mock data
  (mockDb as any).collections = {};
});

test('increments existing religion and organization totals', async () => {
  mockDb.collection('users').doc('u1').set({ religion: 'christian', organizationId: 'org1' });
  mockDb.collection('religion').doc('christian').set({ name: 'Christian', totalPoints: 5 });
  mockDb.collection('organizations').doc('org1').set({ name: 'Org1', totalPoints: 2 });

  await incrementUserReligionOrgPoints('u1', 3);

  const relSnap = await mockDb.collection('religion').doc('christian').get();
  const orgSnap = await mockDb.collection('organizations').doc('org1').get();
  expect(relSnap.data().totalPoints).toBe(8);
  expect(orgSnap.data().totalPoints).toBe(5);
});

test('creates documents if missing', async () => {
  mockDb.collection('users').doc('u2').set({ religion: 'buddhist', organizationId: 'org2' });

  await incrementUserReligionOrgPoints('u2', 4);

  const rel = await mockDb.collection('religion').doc('buddhist').get();
  const org = await mockDb.collection('organizations').doc('org2').get();
  expect(rel.data().totalPoints).toBe(4);
  expect(org.data().totalPoints).toBe(4);
});
