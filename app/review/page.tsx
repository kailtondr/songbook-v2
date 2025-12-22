'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface SongReview {
  id: string;
  titre: string;
  artiste: string;
  reviewed?: boolean; // Le nouveau champ magique
}

export default function ReviewDashboard() {
  const [songs, setSongs] = useState<SongReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('todo');

  useEffect(() => {
    const fetchSongs = async () => {
      const q = query(collection(db, "songs"), orderBy("titre"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SongReview));
      setSongs(list);
      setLoading(false);
    };
    fetchSongs();
  }, []);

  const stats = useMemo(() => {
    const total = songs.length;
    const done = songs.filter(s => s.reviewed).length;
    const todo = total - done;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, todo, percent };
  }, [songs]);

  const filteredSongs = songs.filter(s => {
    if (filter === 'done') return s.reviewed;
    if (filter === 'todo') return !s.reviewed;
    return true;
  });

  if (loading) return <div className="p-10 text-center text-gray-500">Chargement de l'audit...</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER & STATS */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 mb-6">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase">🎛️ Centre de Contrôle</h1>
                <Link href="/" className="text-sm font-bold text-gray-400 hover:text-gray-600">Retour App</Link>
            </div>

            {/* BARRE DE PROGRESSION */}
            <div className="mb-2 flex justify-between text-xs font-bold text-gray-500 uppercase">
                <span>Progression</span>
                <span>{stats.done} / {stats.total} ({stats.percent}%)</span>
            </div>
            <div className="w-full h-4 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-500"
                    style={{ width: `${stats.percent}%` }}
                ></div>
            </div>
        </div>

        {/* FILTRES */}
        <div className="flex gap-2 mb-4">
            <button onClick={() => setFilter('todo')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${filter === 'todo' ? 'bg-red-100 text-red-700' : 'bg-white dark:bg-slate-900 text-gray-500'}`}>
                À faire ({stats.todo})
            </button>
            <button onClick={() => setFilter('done')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${filter === 'done' ? 'bg-green-100 text-green-700' : 'bg-white dark:bg-slate-900 text-gray-500'}`}>
                Fait ({stats.done})
            </button>
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${filter === 'all' ? 'bg-gray-200 text-gray-700' : 'bg-white dark:bg-slate-900 text-gray-500'}`}>
                Tout
            </button>
        </div>

        {/* LISTE DES CHANTS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            {filteredSongs.map((song, idx) => (
                <Link key={song.id} href={`/edit/${song.id}?reviewMode=true`} className="block border-b border-gray-50 dark:border-slate-800 last:border-0 hover:bg-orange-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-gray-300 w-6">{idx + 1}</span>
                            <div>
                                <div className={`font-bold text-sm ${song.reviewed ? 'text-green-700 dark:text-green-400' : 'text-slate-800 dark:text-white'}`}>
                                    {song.titre}
                                </div>
                                <div className="text-xs text-gray-400">{song.artiste}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {song.reviewed ? (
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase">Validé</span>
                            ) : (
                                <span className="bg-red-50 text-red-500 px-2 py-1 rounded text-[10px] font-bold uppercase">À vérifier</span>
                            )}
                            <span className="text-gray-300">→</span>
                        </div>
                    </div>
                </Link>
            ))}
            {filteredSongs.length === 0 && (
                <div className="p-10 text-center text-gray-400">Aucun chant dans cette liste 🎉</div>
            )}
        </div>

      </div>
    </div>
  );
}