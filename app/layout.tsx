import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientLayout from './ClientLayout'; // Importe le composant Client

const inter = Inter({ subsets: ['latin'] });

// C'est ICI que le titre et l'icône sont définis pour le navigateur
export const metadata: Metadata = {
  title: 'Songbook Chantez V.2',
  description: 'Mon carnet de chants numérique',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#d97745',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 dark:bg-slate-950 pb-24 transition-colors duration-300`}>
        {/* On passe la main au ClientLayout pour le reste (Menu, Auth...) */}
        <ClientLayout>
            {children}
        </ClientLayout>
      </body>
    </html>
  );
}