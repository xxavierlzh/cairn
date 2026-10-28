import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './api-url';

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    // Keeps the session cookie in the iOS Keychain / Android Keystore (not plain AsyncStorage).
    expoClient({ scheme: 'cairn', storagePrefix: 'cairn', storage: SecureStore }),
  ],
});
