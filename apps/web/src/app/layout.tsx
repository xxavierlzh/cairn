import './globals.css';

import { APP_NAME, TAGLINE } from '@cairn/core';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: APP_NAME,
  description: TAGLINE,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
