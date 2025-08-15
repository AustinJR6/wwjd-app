import { getAuthHeaders } from '@/utils/authUtils';
import { logTokenIssue } from '@/shared/tokenLogger';
import apiClient from '@/utils/apiClient';
import { endpoints, EndpointName } from './endpoints';

export async function callFunction(name: EndpointName, data: any): Promise<any> {
  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    logTokenIssue(`function:${name}`);
    throw new Error('Missing auth token');
  }

  try {
    const url = endpoints[name];
    const res = await apiClient.post(url, data, { headers });
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

export async function createMultiDayChallenge(prompt: string, days: number, religion?: string) {
  return await callFunction('createMultiDayChallenge', { prompt, days, religion });
}

export async function completeChallengeDay() {
  return await callFunction('completeChallengeDay', {});
}
