// Firebase API helper utilities
export const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

export { getAuthHeader, getAuthHeaders } from '@/utils/TokenManager';
