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
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    const fetchPlaylist = async () => {
      if (!id) return;
      const plDoc = await getDoc(doc(db, "playlists", id));
      if (!plDoc.exists()) return;
      
      const plData = plDoc.data();
      setPlaylist({ id: plDoc.id, ...plData });
      setEditName(plData.name || '');
      setEditDate(plData.date || '');

      if (plData.songs && plData.songs.length > 0) {
        const songsData = await Promise.all(
          plData.songs.map(async (songId: string) => {
            const songDoc = await getDoc(doc(db, "songs", songId));
            if (songDoc.exists()) return { id: songDoc.id, ...songDoc.data() };
            return null;
          })
        );
        setSongs(songsData.filter(s => s !== null));
      }
      setLoading(false);
    };
    fetchPlaylist();
  }, [id]);

  const handleShare = () => {
    if (!playlist) return;
    const dateStr = playlist.date ? new Date(playlist.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    let text = `📅 *${playlist.name}*\n`;
    if (dateStr) text += `${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}\n`;
    text += `\n`; 
    songs.forEach((s, index) => { text += `${index + 1}. ${s.titre} (${s.cle || '?'})\n`; });
    text += `\n🔗 Lien: ${window.location.href}`;
    navigator.clipboard.writeText(text).then(() => alert("📝 Copié !")).catch(err => alert("Erreur copie"));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!playlist) return;
    try {
        await updateDoc(doc(db, "playlists", id), { name: editName, date: editDate });
        setPlaylist({ ...playlist, name: editName, date: editDate }); setIsEditing(false);
    } catch (e) { alert("Erreur"); }
  };

  const removeSong = async (songId: string) => {
    if(!playlist) return;
    const newSongsIds = playlist.songs.filter((sid: string) => sid !== songId);
    setPlaylist({ ...playlist, songs: newSongsIds });
    setSongs(songs.filter(s => s.id !== songId));
    await updateDoc(doc(db, "playlists", id), { songs: newSongsIds });
  };

  const formatDate = (dateStr: string) => {
    if(!dateStr) return "";
    return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) return <div className="p-10 text-center text-gray-400 dark:text-gray-500">Chargement...</div>;
  if (!playlist) return <div className="p-10 text-center dark:text-white">Playlist introuvable</div>;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 sticky top-0 z-10 px-4 py-4 border-b border-gray-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Link href="/playlists" className="p-2 -ml-2 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div className="overflow-hidden">
                <h1 className="font-bold text-lg text-slate-800 dark:text-white leading-none truncate max-w-[200px]">{playlist.name}</h1>
                {playlist.date && <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1 capitalize truncate">{formatDate(playlist.date)}</p>}
            </div>
        </div>
        
        <div className="flex gap-1">
            <button onClick={handleShare} className="p-2 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-full hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </button>
            <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-slate-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </button>
        </div>
      </header>

      {/* Liste */}
      <div className="p-4 space-y-3">
        {songs.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-gray-300 dark:border-slate-800">
                <p>Cette playlist est vide.</p>
                <p className="text-sm mt-2">Allez sur un chant et cliquez sur <br/>"Ajouter à une liste".</p>
                <Link href="/" className="inline-block mt-4 text-orange-600 font-bold text-sm">Chercher un chant →</Link>
            </div>
        ) : (
            songs.map((song, index) => (
                <div key={song.id} className="group relative">
                    <Link href={`/song/${song.id}`}>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4 hover:shadow-md transition-all active:scale-[0.98]">
                            <span className="text-gray-300 dark:text-gray-600 font-bold text-sm w-6">{index + 1}</span>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800 dark:text-gray-200 truncate">{song.titre}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{song.artiste}</p>
                            </div>
                            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 border dark:border-slate-700 px-2 py-1 rounded">{song.cle}</span>
                        </div>
                    </Link>
                    <button onClick={() => removeSong(song.id)} className="absolute -top-2 -right-2 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            ))
        )}
      </div>

      {/* MODAL ÉDITION */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border dark:border-slate-800">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Modifier la Playlist</h3>
                <form onSubmit={handleUpdate} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Nom</label>
                        <input type="text" className="w-full p-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-slate-800 dark:text-white" value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Date</label>
                        <input type="date" className="w-full p-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-slate-800 dark:text-white" value={editDate} onChange={e => setEditDate(e.target.value)} />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-lg font-bold">Annuler</button>
                        <button type="submit" className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-bold">Valider</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </main>
  );
}