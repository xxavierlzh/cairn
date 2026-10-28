import { createApiClient } from '@cairn/core';
import { API_URL } from './api-url';
import { authClient } from './auth-client';

// React Native has no browser cookie jar, so we attach the session cookie ourselves.
// credentials: 'omit' stops fetch from also managing cookies and clashing with ours.
export const api = createApiClient({
  baseUrl: API_URL,
  credentials: 'omit',
  getHeaders: async (): Promise<Record<string, string>> => {
    const cookie = await authClient.getCookie();
    return cookie ? { Cookie: cookie } : {};
  },
});
