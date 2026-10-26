import Constants from 'expo-constants';

/**
 * Where the API server is. In development, Expo Go loads the app from your PC
 * (hostUri looks like "192.168.1.5:8081"), and the API runs on the same PC on port 4000.
 * Set EXPO_PUBLIC_API_URL to override, e.g. when using `expo start --tunnel` or a deployed API.
 */
function resolveApiUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:4000`;
}

export const API_URL = resolveApiUrl();
