'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface ArtistStat {
  name: string;
  count: number;
  songIds: string[];
}

export default function ArtistManager() {
  const [artists, setArtists] = useState<ArtistStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingArtist, setEditingArtist] = useState<ArtistStat | null>(null);
  const [newName, setNewName] = useState('');
  const [processing, setProcessing] = useState(false);

  // 1. Charger et Analyser
  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "songs"), orderBy("artiste"));
      const snapshot = await getDocs(q);
      
      // Regroupement par artiste
      const map = new Map<string, string[]>();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const artistName = (data.artiste || "Inconnu").trim();
        
        if (!map.has(artistName)) {
          map.set(artistName, []);
        }
        map.get(artistName)?.push(doc.id);
      });

      // Conversion en tableau trié
      const list: ArtistStat[] = Array.from(map.entries()).map(([name, ids]) => ({
        name,
        count: ids.length,
        songIds: ids
      })).sort((a, b) => a.name.localeCompare(b.name));

      setArtists(list);
    } catch (e) {
      console.error(e);
      alert("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  // 2. Ouvrir la modale de renommage
  const startEdit = (artist: ArtistStat) => {
    setEditingArtist(artist);
    setNewName(artist.name);
  };

  // 3. Exécuter le changement en masse (Batch)
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArtist || !newName.trim() || newName === editingArtist.name) return;

    setProcessing(true);
    try {
      const batch = writeBatch(db);
      
      // On prépare la mise à jour pour chaque chant de cet artiste
      editingArtist.songIds.forEach(songId => {
        const songRef = doc(db, "songs", songId);
        batch.update(songRef, { artiste: newName.trim() });
      });

      // On envoie tout d'un coup
      await batch.commit();
      
      alert(`✅ ${editingArtist.count} chants mis à jour vers "${newName}"`);
      setEditingArtist(null);
      loadArtists(); // Recharger la liste
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la mise à jour");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 sticky top-0 z-10 px-4 py-3 border-b border-gray-200 dark:border-slate-800 flex items-center gap-3 shadow-sm transition-colors duration-300">
        <Link href="/" className="text-gray-500 dark:text-gray-400 font-bold text-sm hover:text-slate-800 dark:hover:text-white">Retour</Link>
        <h1 className="font-bold text-slate-800 dark:text-white flex-1 text-center">Gestion des Artistes</h1>
        <div className="w-10"></div>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-xl text-sm mb-4 border border-blue-100 dark:border-blue-900/50">
            ℹ️ <b>Astuce :</b> Si vous renommez "Communauté Emanuele" en "Communauté Emmanuel", les deux groupes fusionneront automatiquement.
        </div>

        {loading ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500">Analyse de la bibliothèque...</div>
        ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                {artists.map((artist, idx) => (
                    <div 
                        key={idx} 
                        onClick={() => startEdit(artist)}
                        className="flex justify-between items-center p-4 border-b border-gray-50 dark:border-slate-800 hover:bg-orange-50 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
                    >
                        <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-orange-700 dark:group-hover:text-orange-400">{artist.name}</span>
                        <div className="flex items-center gap-3">
                            <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full border dark:border-slate-700">{artist.count} chants</span>
                            <span className="text-gray-300 dark:text-gray-600 group-hover:text-orange-400">✏️</span>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* MODALE ÉDITION */}
      {editingArtist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border dark:border-slate-800">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1">Renommer l'artiste</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Cela modifiera {editingArtist.count} chants.</p>
                
                <form onSubmit={handleRename}>
                    <input 
                        autoFocus
                        type="text" 
                        className="w-full p-3 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg mb-4 text-slate-800 dark:text-white font-bold focus:border-orange-500 outline-none"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                    />
                    
                    <div className="flex gap-2">
                        <button 
                            type="button"
                            onClick={() => setEditingArtist(null)}
                            className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Annuler
                        </button>
                        <button 
                            type="submit"
                            disabled={processing}
                            className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-colors"
                        >
                            {processing ? '...' : 'Valider'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </main>
  );
}