import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

export async function callFunction(name: string, data: any): Promise<any> {
  try {
    const res = await axios.post(`${API_URL}/${name}`, data);
    return res.data as any;
  } catch (err: any) {
    console.error('🔥 Function error:', err?.message || err);
    throw err;
  }
}

export async function incrementReligionPoints(religion: string, points: number): Promise<void> {
  await callFunction('incrementReligionPoints', { religion, points });
}

export async function createMultiDayChallenge(prompt: string, days: number) {
  return await callFunction('createMultiDayChallenge', { prompt, days });
}

export async function completeChallengeDay() {
  return await callFunction('completeChallengeDay', {});
}
