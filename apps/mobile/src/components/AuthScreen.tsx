import { AuthForm } from '@cairn/ui';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { API_URL } from '@/lib/api-url';
import { authClient } from '@/lib/auth-client';

export function AuthScreen({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerClassName="flex-grow items-center justify-center px-6 py-16"
        keyboardShouldPersistTaps="handled"
      >
        <AuthForm
          mode={mode}
          onSwitchMode={() => router.replace(mode === 'sign-in' ? '/sign-up' : '/sign-in')}
          onSubmit={async ({ name, email, password }) => {
            const { error } =
              mode === 'sign-in'
                ? await authClient.signIn.email({ email, password })
                : await authClient.signUp.email({ name, email, password });
            // On success there's nothing to do: the session updates and the root layout's
            // guards move us to the notes list.
            if (error) return error.message ?? `Couldn't reach the server at ${API_URL}.`;
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
