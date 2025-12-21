'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/authContext';

// --- Icônes du Menu ---
const IconHome = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>;
const IconAdd = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>;
const IconSettings = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;
const IconPlaylist = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;

function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 pb-safe pt-2 px-6 flex justify-between items-center z-50 h-[80px] shadow-[0_-5px_15px_rgba(0,0,0,0.03)] transition-colors duration-300">
        <Link href="/" className={`flex flex-col items-center gap-1 p-2 rounded-xl ${pathname === '/' ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' : 'text-gray-400 hover:text-gray-600'}`}><IconHome /><span className="text-[10px] font-bold">Accueil</span></Link>
        <Link href="/playlists" className={`flex flex-col items-center gap-1 p-2 rounded-xl ${pathname.startsWith('/playlists') ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' : 'text-gray-400 hover:text-gray-600'}`}><IconPlaylist /><span className="text-[10px] font-bold">Listes</span></Link>
        {user && (<Link href="/add" className="flex flex-col items-center justify-center -mt-8 bg-orange-600 text-white rounded-full w-14 h-14 shadow-xl border-4 border-gray-50 dark:border-slate-950"><IconAdd /></Link>)}
        <Link href="/settings" className={`flex flex-col items-center gap-1 p-2 rounded-xl ${pathname.startsWith('/settings') ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' : 'text-gray-400 hover:text-gray-600'}`}><IconSettings /><span className="text-[10px] font-bold">Réglages</span></Link>
    </nav>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const isDark = localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <AuthProvider>
      {children}
      <BottomNav />
    </AuthProvider>
  );
}