'use client';

import type { ApiClient } from '@cairn/core';
import { createContext, type ReactNode, useContext } from 'react';

const ApiContext = createContext<ApiClient | null>(null);

/** Gives the hooks in this package the app's API client (web and mobile configure it differently). */
export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext value={client}>{children}</ApiContext>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApi must be used inside <ApiProvider>');
  return client;
}
