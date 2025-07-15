import { getIdToken } from './auth';

let interval: NodeJS.Timeout | null = null;

export function startTokenRefresh(minutes = 50) {
  stopTokenRefresh();
  interval = setInterval(() => {
    getIdToken(true).catch((err) => {
      console.warn('token refresh failed', err);
    });
  }, minutes * 60 * 1000);
}

export function stopTokenRefresh() {
  if (interval) clearInterval(interval);
  interval = null;
}
