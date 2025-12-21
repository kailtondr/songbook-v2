import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientLayout from './ClientLayout';

const inter = Inter({ subsets: ['latin'] });

// CONFIGURATION DU TITRE ET DE L'ICÔNE (Metadata)
// C'est ce bloc qui change le nom dans l'onglet du navigateur
export const metadata: Metadata = {
  title: 'Songbook Chantez V.2',
  description: 'Mon carnet de chants numérique',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon.ico' }, // Fallback standard
    ],
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
        {/* On délègue toute la logique interactive au ClientLayout */}
        <ClientLayout>
            {children}
        </ClientLayout>
      </body>
    </html>
  );
}