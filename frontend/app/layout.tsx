import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from './providers';

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EFEFF4' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
