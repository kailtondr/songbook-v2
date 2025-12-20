'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore'; // J'ai retiré 'limit' des imports
import { db } from '@/lib/firebase';
import Link from 'next/link';

// Interface pour nos données
interface SongLite {
  id: string;
  titre: string;
  artiste: string;
  cle: string;
  categorie?: string;
}

export default function Home() {
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<SongLite[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. Chargement des données au démarrage
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        // MODIFICATION ICI : On a retiré limit(500)
        // Maintenant, cela charge TOUTE la collection triée par titre.
        const q = query(collection(db, "songs"), orderBy("titre"));
        const querySnapshot = await getDocs(q);
        
        const list: SongLite[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          list.push({ 
            id: doc.id, 
            titre: data.titre || "Sans titre", 
            artiste: data.artiste || "Inconnu", 
            cle: data.cle || "?",
            categorie: data.categorie
          });
        });
        
        setSongs(list);
        setFilteredSongs(list);
      } catch (e) {
        console.error("Erreur de chargement:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSongs();
  }, []);

  // 2. Filtrage quand on tape dans la recherche
  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const results = songs.filter(song => 
        (song.titre?.toLowerCase() || "").includes(term) || 
        (song.artiste?.toLowerCase() || "").includes(term)
    );
    setFilteredSongs(results);
  }, [searchTerm, songs]);

  return (
    <main className="min-h-screen bg-gray-50 pb-32 pt-2">
      
      {/* EN-TÊTE FIXE AVEC RECHERCHE */}
      <header className="bg-white sticky top-0 z-10 px-4 py-4 shadow-sm border-b border-gray-200 rounded-b-2xl mb-4">
        <div className="flex justify-between items-center mb-3">
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">🎵 Songbook</h1>
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full border border-orange-200">
                {songs.length}
            </span>
        </div>
        
        <div className="relative">
            <input 
                type="text" 
                placeholder="Rechercher un chant..." 
                className="w-full pl-10 pr-4 py-3 bg-gray-100 border-transparent focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-xl text-base transition-all outline-none text-slate-800"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* Icône Loupe */}
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            
            {/* Bouton Effacer */}
            {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 p-1 bg-gray-200 rounded-full">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            )}
        </div>
      </header>

      {/* LISTE DES CHANTS */}
      <div className="px-4 space-y-3">
        {loading ? (
           // Effet de chargement (Skeletons)
           [1,2,3,4,5,6].map(i => (
             <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse"></div>
           ))
        ) : filteredSongs.length > 0 ? (
            filteredSongs.map((song) => (
                <Link key={song.id} href={`/song/${song.id}`} className="block group">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm active:scale-[0.98] transition-all flex justify-between items-center hover:border-orange-200 hover:shadow-md">
                    <div className="flex-1 min-w-0 pr-4">
                        <h2 className="font-bold text-gray-800 text-lg truncate group-hover:text-orange-600 transition-colors">{song.titre}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-gray-500 truncate font-medium">{song.artiste}</p>
                            {song.categorie && <span className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-500 rounded border uppercase tracking-wide">{song.categorie}</span>}
                        </div>
                    </div>
                    
                    {/* Badge Clé */}
                    <div className="flex flex-col items-end justify-center">
                        <span className="w-9 h-9 flex items-center justify-center text-sm font-extrabold bg-gray-50 text-slate-600 rounded-lg border border-gray-200 group-hover:bg-orange-50 group-hover:text-orange-600 group-hover:border-orange-200 transition-colors">
                            {song.cle}
                        </span>
                    </div>
                </div>
                </Link>
            ))
        ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p className="text-lg font-medium">Aucun chant trouvé</p>
                <p className="text-sm">Essayez une autre recherche</p>
            </div>
        )}
      </div>
    </main>
  );
}