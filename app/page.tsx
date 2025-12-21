'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, orderBy, query, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/authContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SongLite {
  id: string;
  titre: string;
  artiste: string;
  cle: string;
  categorie?: string;
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedArtist, setSelectedArtist] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoritesIds, setFavoritesIds] = useState<string[]>([]);

  useEffect(() => {
    const initPage = async () => {
      const savedSearch = sessionStorage.getItem('sb_search');
      const savedCat = sessionStorage.getItem('sb_cat');
      const savedArtist = sessionStorage.getItem('sb_artist');

      if (savedSearch) setSearchTerm(savedSearch);
      if (savedCat) setSelectedCategory(savedCat);
      if (savedArtist) setSelectedArtist(savedArtist);

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
            if (userDoc.exists()) setFavoritesIds(userDoc.data().favorites || []);
        };
        fetchFavs();
    } else {
        setFavoritesIds([]); setShowFavoritesOnly(false);
    }
  }, [user]);

  useEffect(() => {
    sessionStorage.setItem('sb_search', searchTerm);
    sessionStorage.setItem('sb_cat', selectedCategory);
    sessionStorage.setItem('sb_artist', selectedArtist);
  }, [searchTerm, selectedCategory, selectedArtist]);

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

  const resetFilters = () => { setSearchTerm(''); setSelectedCategory('all'); setSelectedArtist('all'); setShowFavoritesOnly(false); };

  const handleArtistClick = (e: React.MouseEvent, artistName: string) => {
    e.preventDefault(); e.stopPropagation();
    router.push(`/artist/${encodeURIComponent(artistName)}`);
  };

  const handleCategoryClick = (e: React.MouseEvent, catName: string) => {
    e.preventDefault(); e.stopPropagation();
    setSelectedCategory(catName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    // Fond blanc/noir uni pour l'effet liste continue
    <main className="min-h-screen bg-white dark:bg-slate-950 pb-32 pt-0 transition-colors duration-300">
      
      {/* HEADER FIXE */}
      <header className="bg-white dark:bg-slate-900 sticky top-0 z-10 border-b border-gray-200 dark:border-slate-800 transition-colors duration-300 shadow-sm">
        <div className="px-3 pt-3 pb-2">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <img src="/icon-192.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700" />
                    {/* TITRE APP NORMAL (Pas uppercase) */}
                    <h1 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight leading-none">
                        Songbook <span className="text-orange-600 dark:text-orange-400">Chantez V.2</span>
                    </h1>
                </div>
                <span className="text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                    {filteredSongs.length}
                </span>
            </div>
            
            <div className="relative mb-2">
                <input 
                    type="text" placeholder="Rechercher..." 
                    className="w-full pl-8 pr-8 py-2 bg-gray-100 dark:bg-slate-800 border-none rounded-lg text-sm transition-all outline-none text-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-orange-500"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        ✕
                    </button>
                )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {user && (
                    <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold whitespace-nowrap border transition-all ${showFavoritesOnly ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400' : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400'}`}>
                        <span>{showFavoritesOnly ? '❤️' : '🤍'}</span>
                    </button>
                )}
                <select className={`appearance-none border text-slate-700 dark:text-gray-300 py-1.5 pl-2 pr-6 rounded-md text-[10px] font-bold focus:outline-none focus:border-orange-500 transition-colors ${selectedCategory !== 'all' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400' : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`} value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ backgroundImage: 'none' }}>
                    <option value="all">📂 Tout</option>
                    {categories.map(c => <option key={c} value={c}>📂 {c}</option>)}
                </select>
                <select className={`appearance-none border text-slate-700 dark:text-gray-300 py-1.5 pl-2 pr-6 rounded-md text-[10px] font-bold focus:outline-none focus:border-orange-500 max-w-[120px] transition-colors ${selectedArtist !== 'all' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400' : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`} value={selectedArtist} onChange={(e) => setSelectedArtist(e.target.value)}>
                    <option value="all">🎤 Artistes</option>
                    {artists.map(a => <option key={a} value={a}>🎤 {a}</option>)}
                </select>
                {(selectedCategory !== 'all' || selectedArtist !== 'all' || searchTerm !== '' || showFavoritesOnly) && (
                    <button onClick={resetFilters} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-md text-[10px] font-bold whitespace-nowrap hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">✕</button>
                )}
            </div>
        </div>
      </header>

      {/* LISTE STYLE ONSONG (Continue, Compacte) */}
      <div className="w-full">
        {loading ? ( 
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {[1,2,3,4,5,6,7,8,9,10].map(i => ( <div key={i} className="h-12 bg-gray-50 dark:bg-slate-900 animate-pulse mx-4"></div> ))}
            </div>
        ) : filteredSongs.length > 0 ? (
            // DIVIDE-Y crée les lignes de séparation entre les éléments (Liste collée)
            <div className="divide-y divide-gray-200 dark:divide-slate-800 border-t border-gray-200 dark:border-slate-800">
                {filteredSongs.map((song) => (
                    <Link key={song.id} href={`/song/${song.id}`} className="block group hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors">
                        <div className="px-3 py-2.5 flex justify-between items-center">
                            
                            <div className="flex-1 min-w-0 pr-3">
                                {/* TITRE EN MAJUSCULE (uppercase) */}
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h2 className="font-bold text-slate-900 dark:text-gray-100 text-sm uppercase truncate leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                        {song.titre}
                                    </h2>
                                    {favoritesIds.includes(song.id) && <span className="text-red-500 text-[10px]">❤️</span>}
                                </div>
                                
                                {/* Metadata en tout petit */}
                                <div className="flex items-center flex-wrap gap-1 text-[10px] text-gray-500 dark:text-gray-500 leading-none mt-0.5 font-medium">
                                    {/* ARTISTE EN ORANGE */}
                                    <button 
                                        onClick={(e) => handleArtistClick(e, song.artiste)}
                                        className="text-orange-600 dark:text-orange-400 hover:underline truncate max-w-[180px] text-left uppercase font-bold"
                                    >
                                        {song.artiste}
                                    </button>
                                    
                                    {song.categorie && (
                                        <>
                                            <span className="text-gray-300 dark:text-slate-700">•</span>
                                            <button 
                                                onClick={(e) => handleCategoryClick(e, song.categorie!)}
                                                className="hover:text-orange-600 dark:hover:text-orange-400 hover:underline truncate uppercase"
                                            >
                                                {song.categorie}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Clé : Juste la lettre, très discret */}
                            <div className="flex-shrink-0">
                                <span className="text-xs font-bold text-slate-400 dark:text-slate-600 w-6 text-center inline-block">
                                    {song.cle}
                                </span>
                            </div>

                        </div>
                    </Link>
                ))}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 opacity-60">
                <p className="text-sm">Aucun chant trouvé</p>
            </div>
        )}
      </div>
    </main>
  );
}