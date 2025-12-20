'use client'; 

import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

// --- Icônes ---
const IconHome = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>;
const IconAdd = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>;
// Nouvelle icône Playlist
const IconPlaylist = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <html lang="fr">
      <head>
        <title>Songbook App</title>
        <meta name="description" content="Carnet de chants numérique" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" /> 
        <link rel="manifest" href="/manifest.json" />
      </head>
      
      <body className={`${inter.className} bg-gray-50 pb-24`} suppressHydrationWarning={true}>
        
        {children}

        {/* --- MENU DU BAS --- */}
        <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 pb-safe pt-2 px-6 flex justify-between items-center z-50 h-[80px] shadow-[0_-5px_15px_rgba(0,0,0,0.03)]">
            
            <Link 
                href="/" 
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${pathname === '/' ? 'text-orange-600 bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`}
            >
                <IconHome />
                <span className="text-[10px] font-bold">Accueil</span>
            </Link>

            <Link 
                href="/add"
                className="flex flex-col items-center justify-center -mt-8 bg-orange-600 text-white rounded-full w-14 h-14 shadow-xl active:scale-95 transition-transform border-4 border-gray-50 hover:bg-orange-700"
            >
                <IconAdd />
            </Link>

            {/* Nouveau Lien vers Playlists */}
            <Link 
                href="/playlists"
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${pathname.startsWith('/playlists') ? 'text-orange-600 bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`}
            >
                <IconPlaylist />
                <span className="text-[10px] font-bold">Listes</span>
            </Link>

        </nav>
      </body>
    </html>
  );
}