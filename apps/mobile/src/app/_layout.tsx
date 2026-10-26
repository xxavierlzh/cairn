import '../global.css';

import { ApiProvider, createQueryClient } from '@cairn/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

// Keep the splash screen up until we know whether someone is signed in.
void SplashScreen.preventAutoHideAsync();

const queryClient = createQueryClient();

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession();
  const signedIn = Boolean(session);

  useEffect(() => {
    if (!isPending) void SplashScreen.hideAsync();
  }, [isPending]);

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={api}>
        <Stack screenOptions={{ headerTintColor: '#3e5a39' }}>
          {/* Screens are only reachable while their guard is true. When the session changes,
              Expo Router redirects to the first screen that's allowed. */}
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="index" options={{ title: 'Notes' }} />
            <Stack.Screen name="notes/[id]" options={{ title: '' }} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="sign-up" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
        <StatusBar style="dark" />
      </ApiProvider>
    </QueryClientProvider>
  );
}
