import axios from 'axios';
import { getAuthHeaders } from '@/utils/authUtils';
import { logTokenIssue } from '@/services/authService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

export async function callFunction(name: string, data: any): Promise<any> {
  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    logTokenIssue(`function:${name}`);
    throw new Error('Missing auth token');
  }

  try {
    const res = await axios.post(`${API_URL}/${name}`, data, { headers });
    return res.data as any;
  } catch (err: any) {
    console.error('🔥 Function error:', err?.message || err);
    throw err;
  }
}

export async function incrementReligionPoints(religion: string, points: number): Promise<void> {
  await callFunction('incrementReligionPoints', { religion, points });
}

export async function awardPointsToUser(points: number): Promise<void> {
  await callFunction('awardPointsToUser', { points });
}

export async function createMultiDayChallenge(prompt: string, days: number) {
  return await callFunction('createMultiDayChallenge', { prompt, days });
}

export async function completeChallengeDay() {
  return await callFunction('completeChallengeDay', {});
}
