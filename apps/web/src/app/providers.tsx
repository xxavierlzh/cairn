'use client';

import { ApiProvider, createQueryClient } from '@cairn/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { api } from '@/lib/api';

export function Providers({ children }: { children: ReactNode }) {
  // useState, not a module-level const, so each server render gets its own cache.
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
}
