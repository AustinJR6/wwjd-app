import { functions } from '@/firebase';

export async function callFunction(name: string, data: any): Promise<any> {
  try {
    const callable = functions.httpsCallable(name);
    const res = await callable(data);
    return res.data;
  } catch (err: any) {
    console.error('🔥 Function error:', err?.message || err);
    throw err;
  }
}

export async function incrementReligionPoints(
  religion: string,
  points: number,
): Promise<void> {
  await callFunction('incrementReligionPoints', { religion, points });
}

export async function createMultiDayChallenge(prompt: string, days: number) {
  return await callFunction('createMultiDayChallenge', { prompt, days });
}

export async function completeChallengeDay() {
  return await callFunction('completeChallengeDay', {});
}
