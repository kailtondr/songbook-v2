'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { getAuth, signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';

export default function SettingsPage() {
  const { user } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [downloading, setDownloading] = useState(false); // État de chargement
  const auth = getAuth(app);

  // Charger la préférence au démarrage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDarkMode = localStorage.getItem('theme') === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDark(isDarkMode);
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  // NOUVELLE FONCTION : Force le cache
  const handleDownloadOffline = async () => {
    if (!user) return;
    if (!confirm("Voulez-vous télécharger tous les chants sur votre appareil pour les utiliser sans internet ?")) return;

    setDownloading(true);
    try {
        // On récupère TOUS les chants. 
        // Grâce à la persistance activée dans firebase.ts, ils seront stockés dans le cache.
        const querySnapshot = await getDocs(collection(db, "songs"));
        alert(`✅ Succès ! ${querySnapshot.size} chants sont maintenant disponibles hors-ligne.`);
    } catch (e) {
        console.error(e);
        alert("Erreur lors du téléchargement. Vérifiez votre connexion.");
    } finally {
        setDownloading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 sticky top-0 z-10 px-4 py-4 border-b border-gray-200 dark:border-slate-800 shadow-sm mb-6 transition-colors duration-300">
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">⚙️ Réglages</h1>
      </header>

      <div className="px-4 space-y-6 max-w-lg mx-auto">
        
        {/* Section Compte */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <h2 className="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-slate-800">Compte</h2>
            
            <div className="p-4">
                {user ? (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">Connecté</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                            </div>
                            <button 
                                onClick={handleLogout}
                                className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg font-bold"
                            >
                                Déconnexion
                            </button>
                        </div>

                        {/* BOUTON HORS-LIGNE (Uniquement si connecté) */}
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                            <button 
                                onClick={handleDownloadOffline}
                                disabled={downloading}
                                className="w-full py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
                            >
                                {downloading ? (
                                    <span>Téléchargement...</span>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        <span>Télécharger tout (Hors-ligne)</span>
                                    </>
                                )}
                            </button>
                            <p className="text-[10px] text-center text-gray-400 mt-2">Permet d'accéder aux chants sans internet.</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Connectez-vous pour gérer les artistes, télécharger les chants et sécuriser l'app.</p>
                        <Link 
                            href="/login"
                            className="block w-full py-2 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-lg text-sm"
                        >
                            Se connecter
                        </Link>
                    </div>
                )}
            </div>
        </section>

        {/* Section Apparence (Inchangée) */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <h2 className="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-slate-800">Apparence</h2>
            
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${isDark ? 'bg-slate-800 text-yellow-400' : 'bg-orange-100 text-orange-600'}`}>
                        {isDark ? '🌙' : '☀️'}
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white">Mode Sombre</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{isDark ? 'Activé' : 'Désactivé'}</p>
                    </div>
                </div>
                
                <button 
                    onClick={toggleTheme}
                    className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center ${isDark ? 'bg-orange-600 justify-end' : 'bg-gray-300 justify-start'}`}
                >
                    <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
                </button>
            </div>
        </section>

        {/* Section Administration (Visible seulement si connecté) */}
        {user && (
            <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                <h2 className="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-slate-800">Administration</h2>
                
                <Link href="/admin/artists" className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border-b border-gray-50 dark:border-slate-800 last:border-0">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">🎤</span>
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white">Gérer les Artistes</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Harmoniser les noms</p>
                        </div>
                    </div>
                    <span className="text-gray-400">→</span>
                </Link>
            </section>
        )}

        <div className="text-center pt-8 text-xs text-gray-400 dark:text-gray-600">
            <p>Songbook App v2.2</p>
        </div>

      </div>
    </main>
  );
}