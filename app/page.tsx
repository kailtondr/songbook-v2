'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, orderBy, query, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/authContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // <-- Import Router

// ... (Interface SongLite inchangée)
interface SongLite {
  id: string;
  titre: string;
  artiste: string;
  cle: string;
  categorie?: string;
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter(); // <-- Hook Router
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États de filtrage
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedArtist, setSelectedArtist] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoritesIds, setFavoritesIds] = useState<string[]>([]);

  // 1. Chargement des données + Favoris
  useEffect(() => {
    const initPage = async () => {
      // Restauration Session (Optionnel : si vous voulez garder la mémoire des filtres classiques)
      const savedSearch = sessionStorage.getItem('sb_search');
      const savedCat = sessionStorage.getItem('sb_cat');
      
      if (savedSearch) setSearchTerm(savedSearch);
      if (savedCat) setSelectedCategory(savedCat);

      try {
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
            categorie: data.categorie || "Divers"
          });
        });
        setSongs(list);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    initPage();
  }, []);

  useEffect(() => {
    if (user) {
        const fetchFavs = async () => {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                setFavoritesIds(userDoc.data().favorites || []);
            }
        };
        fetchFavs();
    } else {
        setFavoritesIds([]);
        setShowFavoritesOnly(false);
    }
  }, [user]);

  useEffect(() => {
    sessionStorage.setItem('sb_search', searchTerm);
    sessionStorage.setItem('sb_cat', selectedCategory);
  }, [searchTerm, selectedCategory]);

  const { categories, artists } = useMemo(() => {
    const cats = new Set<string>();
    const arts = new Set<string>();
    songs.forEach(s => {
        if(s.categorie) cats.add(s.categorie.trim());
        if(s.artiste) arts.add(s.artiste.trim());
    });
    return { categories: Array.from(cats).sort(), artists: Array.from(arts).sort() };
  }, [songs]);

  const filteredSongs = useMemo(() => {
    return songs.filter(song => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (song.titre?.toLowerCase() || "").includes(term) || (song.artiste?.toLowerCase() || "").includes(term);
        const matchesCategory = selectedCategory === 'all' || song.categorie === selectedCategory;
        const matchesArtist = selectedArtist === 'all' || song.artiste === selectedArtist;
        const matchesFavorite = showFavoritesOnly ? favoritesIds.includes(song.id) : true;

        return matchesSearch && matchesCategory && matchesArtist && matchesFavorite;
    });
  }, [songs, searchTerm, selectedCategory, selectedArtist, showFavoritesOnly, favoritesIds]);

  const resetFilters = () => {
      setSearchTerm(''); setSelectedCategory('all'); setSelectedArtist('all'); setShowFavoritesOnly(false);
  };

  // --- MODIFICATION ICI : Navigation vers la page Artiste ---
  const handleArtistClick = (e: React.MouseEvent, artistName: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    // On redirige vers la page dédiée
    router.push(`/artist/${encodeURIComponent(artistName)}`);
  };

  const handleCategoryClick = (e: React.MouseEvent, catName: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    setSelectedCategory(catName); // Pour la catégorie, on garde le filtre classique
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 pt-2 transition-colors duration-300">
      
      <header className="bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-sm border-b border-gray-200 dark:border-slate-800 rounded-b-2xl mb-4 overflow-hidden transition-colors duration-300">
        <div className="px-4 pt-4 pb-2">
            <div className="flex justify-between items-center mb-3">
                <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">🎵 Songbook</h1>
                <span className="text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full border border-orange-200 dark:border-orange-800">
                    {filteredSongs.length} / {songs.length}
                </span>
            </div>
            
            <div className="relative mb-3">
                <input 
                    type="text" 
                    placeholder="Rechercher titre, paroles..." 
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 rounded-xl text-base transition-all outline-none text-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 bg-gray-200 dark:bg-slate-700 rounded-full">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {user && (
                    <button 
                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${showFavoritesOnly ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400' : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400'}`}
                    >
                        <span>{showFavoritesOnly ? '❤️' : '🤍'}</span>
                        <span>Favoris</span>
                    </button>
                )}

                <select 
                    className={`appearance-none border text-slate-700 dark:text-gray-300 py-2 pl-3 pr-8 rounded-lg text-xs font-bold focus:outline-none focus:border-orange-500 transition-colors ${selectedCategory !== 'all' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400' : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}
                    value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ backgroundImage: 'none' }}
                >
                    <option value="all">📂 Toutes catégories</option>
                    {categories.map(c => <option key={c} value={c}>📂 {c}</option>)}
                </select>

                <select 
                    className={`appearance-none border text-slate-700 dark:text-gray-300 py-2 pl-3 pr-8 rounded-lg text-xs font-bold focus:outline-none focus:border-orange-500 max-w-[150px] transition-colors ${selectedArtist !== 'all' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400' : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}
                    value={selectedArtist} onChange={(e) => setSelectedArtist(e.target.value)}
                >
                    <option value="all">🎤 Tous les artistes</option>
                    {artists.map(a => <option key={a} value={a}>🎤 {a}</option>)}
                </select>

                {(selectedCategory !== 'all' || selectedArtist !== 'all' || searchTerm !== '' || showFavoritesOnly) && (
                    <button onClick={resetFilters} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">✕ Reset</button>
                )}
            </div>
        </div>
      </header>

      <div className="px-4 space-y-3">
        {loading ? ( [1,2,3,4,5,6].map(i => ( <div key={i} className="h-20 bg-gray-200 dark:bg-slate-800 rounded-xl animate-pulse"></div> )) ) : filteredSongs.length > 0 ? (
            filteredSongs.map((song) => (
                <Link key={song.id} href={`/song/${song.id}`} className="block group">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all flex justify-between items-center hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-md">
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-gray-800 dark:text-gray-100 text-lg truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{song.titre}</h2>
                            {favoritesIds.includes(song.id) && <span className="text-red-500 text-xs">❤️</span>}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {/* ARTISTE CLIQUABLE */}
                            <button 
                                onClick={(e) => handleArtistClick(e, song.artiste)}
                                className="text-sm text-gray-500 dark:text-gray-400 truncate font-medium hover:text-orange-600 dark:hover:text-orange-400 hover:underline text-left"
                            >
                                {song.artiste}
                            </button>
                            
                            {/* CATÉGORIE CLIQUABLE */}
                            {song.categorie && (
                                <button 
                                    onClick={(e) => handleCategoryClick(e, song.categorie!)}
                                    className="text-[10px] px-2 py-0.5 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 rounded border border-gray-200 dark:border-slate-700 uppercase tracking-wide hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                                >
                                    {song.categorie}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end justify-center">
                        <span className="w-9 h-9 flex items-center justify-center text-sm font-extrabold bg-gray-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg border border-gray-200 dark:border-slate-700 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20 group-hover:text-orange-600 dark:group-hover:text-orange-400 group-hover:border-orange-200 dark:group-hover:border-orange-800 transition-colors">{song.cle}</span>
                    </div>
                </div>
                </Link>
            ))
        ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p className="text-lg font-medium">Aucun chant trouvé</p>
                <p className="text-sm text-center">Essayez de réinitialiser les filtres</p>
            </div>
        )}
      </div>
    </main>
  );
}