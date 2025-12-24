'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { getAuth, signOut } from 'firebase/auth';
import { collection, getDocs, getCountFromServer } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';
import { exportData, importData } from '@/lib/backupService'; // <--- IMPORT DU SERVICE

export default function SettingsPage() {
  const { user } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [downloading, setDownloading] = useState(false);
  
  // États pour Export/Import
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [importing, setImporting] = useState(false);

  const auth = getAuth(app);

  useEffect(() => {
    // 1. Gestion du Thème Sombre
    if (typeof window !== 'undefined') {
      const isDarkMode = localStorage.getItem('theme') === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDark(isDarkMode);
    }

    // 2. Chargement des catégories pour le menu déroulant d'export
    const loadCats = async () => {
        try {
            const snap = await getDocs(collection(db, "songs"));
            const cats = new Set<string>();
            snap.docs.forEach(d => { 
                const cat = d.data().categorie;
                if(cat) cats.add(cat.trim()); 
            });
            setCategories(Array.from(cats).sort());
        } catch (e) {
            console.error("Erreur chargement catégories", e);
        }
    };
    loadCats();
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

  // --- FONCTION DE TÉLÉCHARGEMENT HORS-LIGNE (EXISTANTE) ---
  const handleDownloadOffline = async () => {
    if (!user) return;
    if (!navigator.onLine) return alert("⚠️ Vous n'êtes pas connecté à internet. Impossible de télécharger.");
    if (!confirm("Télécharger la base de données complète pour l'usage hors-ligne ?")) return;

    setDownloading(true);
    try {
        const coll = collection(db, "songs");
        const snapshot = await getCountFromServer(coll);
        const count = snapshot.data().count;
        await getDocs(coll); // Force le cache
        await getDocs(collection(db, "playlists")); // Force le cache playlists
        alert(`✅ Succès ! ${count} chants (et vos playlists) sont maintenant sécurisés dans votre appareil.`);
    } catch (e: any) {
        console.error("Erreur download:", e);
        alert(`Erreur : ${e.message || "Problème inconnu"}`);
    } finally {
        setDownloading(false);
    }
  };

  // --- NOUVELLES FONCTIONS D'IMPORT/EXPORT ---
  const handleExport = (type: 'all' | 'category') => {
      if(type === 'category' && !selectedCat) return alert("Sélectionnez une catégorie.");
      if(!confirm("Générer le fichier de sauvegarde ?")) return;
      exportData(type, type === 'category' ? selectedCat : undefined);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      
      if(!confirm(`⚠️ ATTENTION : Vous allez importer des chants.\nSi un chant existe déjà (même ID), il sera écrasé.\n\nContinuer ?`)) {
          e.target.value = ''; 
          return;
      }

      setImporting(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const count = await importData(event.target?.result as string);
              alert(`✅ Succès ! ${count} chants importés.`);
              window.location.reload();
          } catch (err) {
              alert("Erreur: Le fichier est invalide ou corrompu.");
          } finally {
              setImporting(false);
          }
      };
      reader.readAsText(file);
  };

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 pb-32 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 sticky top-0 z-10 px-4 py-4 border-b border-gray-100 dark:border-slate-800 shadow-sm mb-6 transition-colors duration-300">
        <h1 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">⚙️ Réglages</h1>
      </header>

      <div className="px-4 space-y-6 max-w-lg mx-auto">
        
        {/* 1. SECTION COMPTE (EXISTANTE) */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <h2 className="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-slate-800">Compte</h2>
            
            <div className="p-4">
                {user ? (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white text-sm">Connecté en tant que</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                            </div>
                            <button onClick={handleLogout} className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg font-bold">
                                Déconnexion
                            </button>
                        </div>

                        {/* BOUTON HORS-LIGNE */}
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                            <button 
                                onClick={handleDownloadOffline}
                                disabled={downloading}
                                className={`w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${downloading ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'}`}
                            >
                                {downloading ? (
                                    <span>Synchronisation...</span>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        <span>Télécharger pour Hors-ligne</span>
                                    </>
                                )}
                            </button>
                            <p className="text-[10px] text-center text-gray-400 mt-2">Cliquez ici quand vous avez du Wifi pour stocker les chants.</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Connectez-vous pour gérer les artistes et sécuriser l'app.</p>
                        <Link href="/login" className="block w-full py-2 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-lg text-sm">Se connecter</Link>
                    </div>
                )}
            </div>
        </section>

        {/* 2. SECTION APPARENCE (EXISTANTE) */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <h2 className="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-slate-800">Apparence</h2>
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${isDark ? 'bg-slate-800 text-yellow-400' : 'bg-orange-100 text-orange-600'}`}>
                        {isDark ? '🌙' : '☀️'}
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white text-sm">Mode Sombre</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{isDark ? 'Activé' : 'Désactivé'}</p>
                    </div>
                </div>
                <button onClick={toggleTheme} className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 flex items-center ${isDark ? 'bg-orange-600 justify-end' : 'bg-gray-200 justify-start'}`}>
                    <div className="w-5 h-5 bg-white rounded-full shadow-md"></div>
                </button>
            </div>
        </section>

        {/* 3. NOUVELLE SECTION : IMPORT / EXPORT (AJOUTÉE) */}
        {user && (
            <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                <h2 className="px-4 py-3 bg-blue-50 dark:bg-blue-900/10 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase border-b border-blue-100 dark:border-blue-900/20">💾 Sauvegarde & Partage</h2>
                
                <div className="p-4 space-y-4">
                    {/* EXPORT */}
                    <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-white mb-2">📤 Exporter des chants</p>
                        <div className="flex gap-2 mb-2">
                            <button onClick={() => handleExport('all')} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700">
                                Tout exporter
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <select className="flex-1 text-xs p-2 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 dark:text-white outline-none" value={selectedCat} onChange={e => setSelectedCat(e.target.value)}>
                                <option value="">-- Par catégorie --</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button onClick={() => handleExport('category')} className="px-4 py-2 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg text-xs font-bold hover:bg-orange-200 transition-colors">
                                OK
                            </button>
                        </div>
                    </div>

                    <div className="w-full h-px bg-gray-100 dark:bg-slate-800"></div>

                    {/* IMPORT */}
                    <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-white mb-2">📥 Importer (JSON)</p>
                        <label className={`block w-full text-center py-3 border-2 border-dashed ${importing ? 'border-gray-400 bg-gray-100' : 'border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer'} rounded-xl transition-colors`}>
                            <input type="file" accept=".json" onChange={handleImportFile} disabled={importing} className="hidden" />
                            <div className="text-blue-600 dark:text-blue-400 font-bold text-xs">
                                {importing ? 'Importation en cours...' : 'Cliquez pour choisir un fichier'}
                            </div>
                        </label>
                    </div>
                </div>
            </section>
        )}

        {/* 4. SECTION ADMINISTRATION (EXISTANTE) */}
        {user && (
            <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                <h2 className="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-slate-800">Administration</h2>
                
                <Link href="/review" className="flex items-center justify-between p-4 hover:bg-orange-50 dark:hover:bg-slate-800 transition-colors border-b border-gray-50 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">🧐</span>
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white text-sm">Mode Revue</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Auditer et valider les chants</p>
                        </div>
                    </div>
                    <span className="text-gray-400">→</span>
                </Link>

                <Link href="/admin/artists" className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border-b border-gray-50 dark:border-slate-800 last:border-0">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">🎤</span>
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white text-sm">Gérer les Artistes</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Harmoniser les noms</p>
                        </div>
                    </div>
                    <span className="text-gray-400">→</span>
                </Link>
            </section>
        )}

        <div className="text-center pt-8 text-xs text-gray-400 dark:text-gray-600">
            <p>Songbook App v2.4</p>
        </div>

      </div>
    </main>
  );
}