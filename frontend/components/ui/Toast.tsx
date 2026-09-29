'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from '@/app/providers';

function Toaster() {
  const { theme } = useTheme();

  return (
    <SonnerToaster
      theme={theme}
      position="top-center"
      richColors
      closeButton
      duration={4000}
      offset="calc(12px + env(safe-area-inset-top))"
      toastOptions={{
        style: {
          fontFamily: 'var(--font-ui)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid var(--glass-border)',
          color: 'var(--warm-gray-1)',
        },
      }}
    />
  );
}

export { Toaster };
export { toast } from 'sonner';
