// Firebase API helper utilities
import Constants from 'expo-constants';

export const API_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || '';
if (!API_URL) {
  console.warn('⚠️ Missing EXPO_PUBLIC_API_URL in .env');
}

export { getAuthHeader, getAuthHeaders } from '@/utils/authUtils';
