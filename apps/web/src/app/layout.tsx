import './globals.css';

import { APP_NAME, TAGLINE } from '@cairn/core';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: APP_NAME,
  description: TAGLINE,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white antialiased">{children}</body>
    </html>
  );
}
