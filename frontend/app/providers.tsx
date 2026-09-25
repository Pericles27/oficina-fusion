'use client';

import { ReactNode } from 'react';
import { CajaProvider } from '@/lib/caja-store';
import { Toaster } from '@/components/ui';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <CajaProvider>
      <div className="app-root">
        {children}
        <Toaster />
      </div>
    </CajaProvider>
  );
}
