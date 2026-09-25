'use client';

import { Toaster as SonnerToaster } from 'sonner';

function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      style={{
        fontFamily: 'var(--font-ui)',
      }}
    />
  );
}

export { Toaster };
export { toast } from 'sonner';
