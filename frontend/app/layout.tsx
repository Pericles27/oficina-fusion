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
    { media: '(prefers-color-scheme: light)', color: 'var(--bg-base, #EFEFF4)' },
    { media: '(prefers-color-scheme: dark)', color: 'var(--surface, #000000)' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <head>
        {/* Anti-flash: setea data-theme ANTES de que el CSS y React hidraten.
            Con output: 'export' (estático) no hay servidor que lo resuelva. */}
        <script
          dangerouslySetInnerHTML={{
            __html: '(()=>{var a=localStorage.getItem("of-theme"),b=a==="dark"||a==="light"?a:"system";if(b==="system"){var c=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=c?"dark":"light"}else document.documentElement.dataset.theme=b})()',
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
