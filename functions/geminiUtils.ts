import * as logger from 'firebase-functions/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from './firebase';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export function createGeminiModel() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    return genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  } catch (err) {
    logger.error('Failed to initialize GoogleGenerativeAI', err);
    throw err;
  }
}

export async function fetchReligionContext(religionId?: string) {
  const fallback = { name: 'Spiritual Guide', aiVoice: 'Reflective Mentor' };
  if (!religionId) return fallback;
  try {
    const doc = await db.collection('religion').doc(religionId).get();
    if (!doc.exists) return fallback;
    const data = doc.data() || {};
    return {
      name: (data as any).name || fallback.name,
      aiVoice: (data as any).aiVoice || fallback.aiVoice,
    };
  } catch (err) {
    logger.warn('Failed to fetch religion context', err);
    return fallback;
  }
}
