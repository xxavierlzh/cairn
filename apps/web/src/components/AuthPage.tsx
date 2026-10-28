'use client';

import { AuthForm } from '@cairn/ui';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();

  return (
    <main className="flex min-h-full items-center justify-center px-6 py-12">
      <AuthForm
        mode={mode}
        onSwitchMode={() => router.push(mode === 'sign-in' ? '/sign-up' : '/sign-in')}
        onSubmit={async ({ name, email, password }) => {
          const { error } =
            mode === 'sign-in'
              ? await authClient.signIn.email({ email, password })
              : await authClient.signUp.email({ name, email, password });
          if (error) return error.message ?? 'Something went wrong. Please try again.';
          router.replace('/notes');
        }}
      />
    </main>
  );
}
