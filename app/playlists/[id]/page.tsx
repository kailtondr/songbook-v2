'use client';

import { useEffect, useState, use } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function PlaylistDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [playlist, setPlaylist] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Charger la playlist et ses chants
  useEffect(() => {
    const fetchPlaylist = async () => {
      if (!id) return;
      
      // 1. Récupérer la playlist
      const plDoc = await getDoc(doc(db, "playlists", id));
      if (!plDoc.exists()) return;
      
      const plData = plDoc.data();
      setPlaylist({ id: plDoc.id, ...plData });

      // 2. Récupérer les détails de chaque chant
      if (plData.songs && plData.songs.length > 0) {
        const songsData = await Promise.all(
          plData.songs.map(async (songId: string) => {
            const songDoc = await getDoc(doc(db, "songs", songId));
            if (songDoc.exists()) {
              return { id: songDoc.id, ...songDoc.data() };
            }
            return null;
          })
        );
        setSongs(songsData.filter(s => s !== null));
      }
      setLoading(false);
    };
    fetchPlaylist();
  }, [id]);

  // Retirer un chant de la playlist
  const removeSong = async (songId: string) => {
    if(!playlist) return;
    const newSongs = playlist.songs.filter((sid: string) => sid !== songId);
    
    // Mise à jour locale
    setPlaylist({ ...playlist, songs: newSongs });
    setSongs(songs.filter(s => s.id !== songId));

    // Mise à jour Cloud
    await updateDoc(doc(db, "playlists", id), { songs: newSongs });
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Chargement...</div>;
  if (!playlist) return <div className="p-10 text-center">Playlist introuvable</div>;

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 px-4 py-4 border-b border-gray-200 shadow-sm flex items-center gap-3">
        <Link href="/playlists" className="p-2 -ml-2 text-gray-500 rounded-full hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="font-bold text-lg text-slate-800">{playlist.name}</h1>
        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">{songs.length}</span>
      </header>

      {/* Liste des chants */}
      <div className="p-4 space-y-3">
        {songs.length === 0 ? (
            <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                <p>Cette playlist est vide.</p>
                <p className="text-sm mt-2">Allez sur un chant et cliquez sur <br/>"Ajouter à une liste".</p>
                <Link href="/" className="inline-block mt-4 text-orange-600 font-bold text-sm">Chercher un chant →</Link>
            </div>
        ) : (
            songs.map((song, index) => (
                <div key={song.id} className="group relative">
                    <Link href={`/song/${song.id}`}>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                            <span className="text-gray-300 font-bold text-sm w-6">{index + 1}</span>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800 truncate">{song.titre}</h3>
                                <p className="text-xs text-gray-500">{song.artiste}</p>
                            </div>
                            <span className="text-xs font-bold text-gray-400 border px-2 py-1 rounded">{song.cle}</span>
                        </div>
                    </Link>
                    {/* Bouton Retirer (visible au survol ou swipe sur mobile) */}
                    <button 
                        onClick={() => removeSong(song.id)}
                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        title="Retirer de la liste"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            ))
        )}
      </div>
    </main>
  );
}