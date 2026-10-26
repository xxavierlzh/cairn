import { createAuthClient } from 'better-auth/react';

// No baseURL: the auth endpoints are on this same origin (/api/auth, proxied to the API).
export const authClient = createAuthClient();
