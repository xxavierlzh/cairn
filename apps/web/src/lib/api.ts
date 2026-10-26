import { createApiClient } from '@cairn/core';

// Empty baseUrl: requests go to /api/* on this origin, and the browser sends the session cookie.
export const api = createApiClient({ baseUrl: '' });
