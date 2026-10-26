'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

/** Everything under /notes needs a session. Signed-out visitors go to /sign-in. */
export default function NotesLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

  if (!session) {
    return <p className="p-6 text-stone-500">Loading…</p>;
  }

  async function signOut() {
    await authClient.signOut();
    // Drop cached notes so the next person to sign in on this browser can't see them.
    queryClient.clear();
    router.replace('/sign-in');
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 px-4">
        <Link href="/notes" className="text-lg font-bold text-stone-900">
          Cairn
        </Link>
        <div className="flex items-center gap-3 text-sm text-stone-600">
          <span className="hidden sm:inline">{session.user.email}</span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg px-3 py-1.5 font-medium hover:bg-stone-100"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
