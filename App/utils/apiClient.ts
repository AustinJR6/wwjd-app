import axios from 'axios';
import { getIdToken } from '@/utils/authUtils';
import { signOutAndRetry } from '@/services/authLogger';

let refreshPromise: Promise<string | null> | null = null;

async function getValidToken(force = false): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = getIdToken(true)
    .catch((err) => {
      refreshPromise = null;
      throw err;
    })
    .then((t) => {
      refreshPromise = null;
      return t;
    });
  return refreshPromise;
}

const client = axios.create({});

client.interceptors.request.use(async (config: any) => {
  const token = await getValidToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const original = error.config;
    if (status === 401 && !original.__retry) {
      try {
        const token = await getValidToken(true);
        if (!token) throw new Error('no token');
        original.__retry = true;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return client(original);
      } catch {
        await signOutAndRetry();
      }
    }
    return Promise.reject(error);
  },
);

export default client;
