import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from './providers';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Oficina Fusion — Sistema de Gestión',
  description: 'Sistema integral de oficina financiera',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Oficina Fusion',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <head>
        <script id="of-theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
