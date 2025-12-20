'use client';

import { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  // Charger les playlists en temps réel
  useEffect(() => {
    const q = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlaylists(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Créer une playlist
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await addDoc(collection(db, "playlists"), {
        name: newName,
        createdAt: new Date(),
        songs: [] // Tableau vide d'IDs de chants
      });
      setNewName('');
      setIsCreating(false);
    } catch (error) {
      alert("Erreur création");
    }
  };

  // Supprimer une playlist
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); // Empêcher le clic sur le lien
    if (confirm("Supprimer cette playlist ?")) {
      await deleteDoc(doc(db, "playlists", id));
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-32 p-4">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-6">Mes Playlists</h1>

      {/* Bouton Créer */}
      {!isCreating ? (
        <button 
          onClick={() => setIsCreating(true)}
          className="w-full py-3 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:border-orange-500 hover:text-orange-500 transition-colors mb-6 flex items-center justify-center gap-2"
        >
          <span>+ Nouvelle Playlist</span>
        </button>
      ) : (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-xl shadow-sm mb-6 border border-orange-100">
          <label className="text-xs font-bold text-gray-500 uppercase">Nom de la liste</label>
          <div className="flex gap-2 mt-2">
            <input 
              autoFocus
              type="text" 
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500 text-slate-800"
              placeholder="Ex: Culte Dimanche..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm">OK</button>
            <button type="button" onClick={() => setIsCreating(false)} className="text-gray-400 px-2">✕</button>
          </div>
        </form>
      )}

      {/* Liste */}
      <div className="space-y-3">
        {loading ? <p className="text-center text-gray-400">Chargement...</p> : 
         playlists.length === 0 ? <p className="text-center text-gray-400 py-10">Aucune playlist pour l'instant.</p> :
         playlists.map(playlist => (
           <Link key={playlist.id} href={`/playlists/${playlist.id}`} className="block group">
             <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center hover:shadow-md transition-all">
               <div>
                 <h3 className="font-bold text-slate-800 text-lg group-hover:text-orange-600">{playlist.name}</h3>
                 <p className="text-xs text-gray-400">{playlist.songs?.length || 0} chants</p>
               </div>
               <button 
                 onClick={(e) => handleDelete(playlist.id, e)}
                 className="p-2 text-gray-300 hover:text-red-500 transition-colors"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
               </button>
             </div>
           </Link>
         ))
        }
      </div>
    </main>
  );
}