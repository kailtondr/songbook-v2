'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, getDocs, deleteDoc, doc, addDoc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/authContext';
import Link from 'next/link';
import SwipeableSongRow from '@/components/SwipeableSongRow';

export default function Home() {
  const { user } = useAuth();
  
  // DONNÉES
  const [songs, setSongs] = useState<any[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // ÉTATS DE FILTRES
  const [search, setSearch] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ÉTATS DES MODALES DE SELECTION
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // ÉTATS PLAYLIST (Ajout rapide)
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPl, setIsCreatingPl] = useState(false);

  // 1. CHARGEMENT INITIAL
  useEffect(() => {
    const fetchSongs = async () => {
      const q = query(collection(db, "songs"), orderBy("titre"));
      const querySnapshot = await getDocs(q);
      const songsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSongs(songsList);
      setFilteredSongs(songsList);
      setLoading(false);
    };
    fetchSongs();
  }, []);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) setFavorites(userDoc.data().favorites || []);
        } catch (e) { console.error("Err favoris", e); }
      }
    };
    fetchFavorites();
  }, [user]);

  // 2. EXTRACTION DYNAMIQUE DES LISTES (Pour les filtres)
  const availableArtists = useMemo(() => {
    const artists = new Set(songs.map(s => s.artiste ? s.artiste.trim() : "Inconnu").filter(Boolean));
    return Array.from(artists).sort();
  }, [songs]);

  const availableCategories = useMemo(() => {
    const categories = new Set(songs.map(s => s.categorie ? s.categorie.trim() : "Autre").filter(Boolean));
    return Array.from(categories).sort();
  }, [songs]);

  // 3. MOTEUR DE FILTRAGE
  useEffect(() => {
    let result = [...songs];

    // A. Recherche Texte
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(song =>
        song.titre?.toLowerCase().includes(lowerSearch) ||
        song.artiste?.toLowerCase().includes(lowerSearch) ||
        song.contenu?.toLowerCase().includes(lowerSearch)
      );
    }

    // B. Filtre Favoris
    if (showFavoritesOnly) {
      result = result.filter(s => favorites.includes(s.id));
    }

    // C. Filtre Artiste
    if (selectedArtist) {
      result = result.filter(s => (s.artiste || "Inconnu") === selectedArtist);
    }

    // D. Filtre Catégorie
    if (selectedCategory) {
      result = result.filter(s => (s.categorie || "Autre") === selectedCategory);
    }

    setFilteredSongs(result);
  }, [search, songs, showFavoritesOnly, selectedArtist, selectedCategory, favorites]);


  // --- ACTIONS ---
  const handleDeleteSong = async (id: string) => {
      try {
          await deleteDoc(doc(db, "songs", id));
          setSongs(prev => prev.filter(s => s.id !== id));
      } catch (e) { alert("Erreur suppression"); }
  };

  const handleOpenPlaylistModal = async (songId: string) => {
      setSelectedSongId(songId);
      setShowPlaylistModal(true);
      if (playlists.length === 0) {
          const q = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
          const snap = await getDocs(q);
          setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
  };

  const addToPlaylist = async (playlistId: string, name: string) => {
      if(!selectedSongId) return;
      try {
          await updateDoc(doc(db, "playlists", playlistId), { songs: arrayUnion(selectedSongId) });
          alert(`Ajouté à ${name} !`);
          setShowPlaylistModal(false);
      } catch (e) { alert("Erreur ajout"); }
  };

  const createAndAddPlaylist = async (e: React.FormEvent) => {
      e.preventDefault(); if(!newPlaylistName || !selectedSongId) return;
      try {
          await addDoc(collection(db, "playlists"), { name: newPlaylistName, createdAt: new Date(), songs: [selectedSongId] });
          alert("Playlist créée !");
          setShowPlaylistModal(false);
      } catch (e) { alert("Erreur création"); }
  };

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 pb-32">
      
      {/* HEADER TYPE "IDEAL.PNG" */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 pt-3 pb-2 px-3 shadow-sm border-b border-gray-100 dark:border-slate-800">
        
        {/* LIGNE 1 : LOGO + TITRE */}
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <img src="/icon-192.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover shadow-sm" />
                <h1 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">
                    Songbook <span className="text-orange-600">Chantez V.2</span>
                </h1>
            </div>
            {/* Compteur discret */}
            <span className="bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 text-[10px] font-bold px-2 py-1 rounded">
                {filteredSongs.length}
            </span>
        </div>

        {/* LIGNE 2 : RECHERCHE */}
        <div className="relative mb-3">
            <input 
                type="text" 
                placeholder="Rechercher..." 
                className="w-full bg-gray-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg px-4 py-2.5 pl-10 outline-none text-sm placeholder-gray-400 font-medium transition-all focus:ring-2 focus:ring-orange-100"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        {/* LIGNE 3 : FILTRES (BOUTONS DE SÉLECTION) */}
        <div className="flex gap-2">
            
            {/* 1. FAVORIS (Toggle) */}
            <button 
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`p-2 border rounded-lg transition-colors flex-shrink-0 ${showFavoritesOnly ? 'bg-red-50 border-red-200 text-red-600' : 'border-gray-200 dark:border-slate-700 text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
               <svg className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </button>

            {/* 2. CATÉGORIE (Selecteur) */}
            <button 
                onClick={() => setShowCategoryModal(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors truncate ${selectedCategory ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-100 dark:bg-slate-800 border-transparent text-slate-600 dark:text-gray-300'}`}
            >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                <span className="truncate">{selectedCategory || "Tout"}</span>
            </button>

            {/* 3. ARTISTES (Selecteur) */}
            <button 
                onClick={() => setShowArtistModal(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors truncate ${selectedArtist ? 'bg-orange-50 border-orange-200 text-orange-700' : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                <span className="truncate">{selectedArtist || "Artistes"}</span>
            </button>
        </div>
      </header>

      {/* LISTE DES CHANTS */}
      <div className="w-full">
        {loading ? (
            <div className="text-center text-gray-400 mt-10 text-sm">Chargement...</div>
        ) : (
            <div>
                {/* Indicateur de filtre actif */}
                {(selectedArtist || selectedCategory || showFavoritesOnly) && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-slate-900 flex gap-2 overflow-x-auto no-scrollbar">
                        {showFavoritesOnly && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold whitespace-nowrap">❤️ Favoris</span>}
                        {selectedCategory && <button onClick={() => setSelectedCategory(null)} className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-bold whitespace-nowrap flex items-center gap-1">📂 {selectedCategory} ✕</button>}
                        {selectedArtist && <button onClick={() => setSelectedArtist(null)} className="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-bold whitespace-nowrap flex items-center gap-1">🎤 {selectedArtist} ✕</button>}
                    </div>
                )}

                {filteredSongs.map((song) => (
                    <SwipeableSongRow 
                        key={song.id} 
                        song={song} 
                        onDelete={() => handleDeleteSong(song.id)}
                        onAddToPlaylist={() => handleOpenPlaylistModal(song.id)}
                    />
                ))}
                
                {filteredSongs.length === 0 && (
                    <div className="flex flex-col items-center justify-center mt-10 text-gray-400">
                        <p className="text-sm">Aucun chant trouvé</p>
                        <button onClick={() => { setSearch(''); setSelectedArtist(null); setSelectedCategory(null); setShowFavoritesOnly(false); }} className="mt-2 text-xs text-blue-500 font-bold underline">Réinitialiser les filtres</button>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* FAB AJOUT */}
      <Link href="/add" className="fixed bottom-6 right-6 w-14 h-14 bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-orange-700 transition-transform active:scale-90 z-40">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
      </Link>

      {/* --- MODALES --- */}

      {/* 1. MODALE CHOIX ARTISTE */}
      {showArtistModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowArtistModal(false)}>
            <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl h-[70vh] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-slate-800 bg-gray-50 dark:bg-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white">Choisir un Artiste</h3>
                    <button onClick={() => setShowArtistModal(false)} className="text-gray-400 text-sm">Fermer</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    <button onClick={() => { setSelectedArtist(null); setShowArtistModal(false); }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 font-bold text-blue-600 border-b border-gray-100 dark:border-slate-800 mb-2">
                        Tous les artistes
                    </button>
                    {availableArtists.map(artist => (
                        <button key={artist} onClick={() => { setSelectedArtist(artist); setShowArtistModal(false); }} className={`w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium ${selectedArtist === artist ? 'text-orange-600 bg-orange-50 font-bold' : 'text-slate-700 dark:text-gray-300'}`}>
                            {artist}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* 2. MODALE CHOIX CATEGORIE */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowCategoryModal(false)}>
            <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl h-[60vh] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-slate-800 bg-gray-50 dark:bg-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white">Choisir une Catégorie</h3>
                    <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 text-sm">Fermer</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    <button onClick={() => { setSelectedCategory(null); setShowCategoryModal(false); }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 font-bold text-blue-600 border-b border-gray-100 dark:border-slate-800 mb-2">
                        Toutes les catégories
                    </button>
                    {availableCategories.map(cat => (
                        <button key={cat} onClick={() => { setSelectedCategory(cat); setShowCategoryModal(false); }} className={`w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium ${selectedCategory === cat ? 'text-blue-600 bg-blue-50 font-bold' : 'text-slate-700 dark:text-gray-300'}`}>
                            {cat}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* 3. MODALE PLAYLIST (Standard) */}
      {showPlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[80vh] border dark:border-slate-800">
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-white">Ajouter à...</h3>
                    <button onClick={() => setShowPlaylistModal(false)} className="text-gray-400 hover:text-white">✕</button>
                </div>
                <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-orange-50/50 dark:bg-orange-900/10">
                    {!isCreatingPl ? (
                        <button onClick={() => setIsCreatingPl(true)} className="w-full py-2 border-2 border-dashed border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 font-bold rounded-xl text-sm">+ Nouvelle Playlist</button>
                    ) : (
                        <form onSubmit={createAndAddPlaylist} className="flex gap-2">
                            <input autoFocus type="text" placeholder="Nom..." className="flex-1 px-3 py-2 rounded-lg border border-orange-200 dark:border-orange-800 dark:bg-slate-800 dark:text-white text-sm" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} />
                            <button type="submit" className="bg-orange-600 text-white px-3 py-2 rounded-lg font-bold text-xs">OK</button>
                        </form>
                    )}
                </div>
                <div className="overflow-y-auto p-2 flex-1">
                    {playlists.map(pl => (
                        <button key={pl.id} onClick={() => addToPlaylist(pl.id, pl.name)} className="w-full text-left p-3 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-xl flex items-center justify-between group border-b border-gray-50 dark:border-slate-800 last:border-0">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{pl.name}</span>
                            <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 px-2 py-1 rounded-full">{pl.songs?.length || 0}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

    </main>
  );
}