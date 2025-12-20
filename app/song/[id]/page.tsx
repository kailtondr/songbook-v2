'use client';

import { useEffect, useState, use } from 'react';
import { doc, getDoc, collection, query, orderBy, getDocs, updateDoc, arrayUnion, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { parseChordPro, transposeChord, guessPreferFlats } from '@/lib/musicEngine';
import Link from 'next/link';

// --- Icônes ---
const IconBack = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>;
const IconEdit = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
const IconPlaylistAdd = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

interface SongData {
    id: string;
    titre: string;
    artiste: string;
    contenu: string;
    cle: string;
    categorie: string;
}

export default function SongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // États Principaux
  const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING');
  const [errorMessage, setErrorMessage] = useState('');
  const [song, setSong] = useState<SongData | null>(null);

  // États Affichage
  const [semitones, setSemitones] = useState(0);
  const [showChords, setShowChords] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [preferFlat, setPreferFlat] = useState(false);

  // États Playlist Modal
  const [showModal, setShowModal] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  
  // États Création Playlist Rapide
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // 1. Charger le chant
  useEffect(() => {
    const loadData = async () => {
      try {
        if (!id) throw new Error("ID manquant");
        const docRef = doc(db, "songs", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setSong({ 
              id: docSnap.id, 
              titre: data.titre || "Sans titre",
              artiste: data.artiste || "Inconnu",
              contenu: data.contenu || "",
              cle: data.cle || "C",
              categorie: data.categorie || ""
          });
          if (data.cle && guessPreferFlats(data.cle)) setPreferFlat(true);
          setStatus('SUCCESS');
        } else {
          setErrorMessage("Chant introuvable");
          setStatus('ERROR');
        }
      } catch (err: any) {
        setErrorMessage(err.message);
        setStatus('ERROR');
      }
    };
    loadData();
  }, [id]);

  // 2. Charger les playlists (quand on ouvre le modal)
  const openPlaylistModal = async () => {
    setShowModal(true);
    setIsCreating(false); // Reset état création
    setNewPlaylistName(''); // Reset nom
    
    if (playlists.length > 0) return; // Déjà chargé

    setLoadingPlaylists(true);
    try {
      const q = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlaylists(list);
    } catch (e) {
      console.error(e);
      alert("Erreur chargement playlists");
    } finally {
      setLoadingPlaylists(false);
    }
  };

  // 3. Ajouter à une playlist existante
  const addToPlaylist = async (playlistId: string, playlistName: string) => {
    try {
      const playlistRef = doc(db, "playlists", playlistId);
      await updateDoc(playlistRef, {
        songs: arrayUnion(id)
      });
      alert(`Ajouté à "${playlistName}" ! ✅`);
      setShowModal(false);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'ajout");
    }
  };

  // 4. Créer ET Ajouter (Nouvelle fonction)
  const createAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newPlaylistName.trim()) return;

    try {
      // Création de la playlist avec le chant DIRECTEMENT dedans
      await addDoc(collection(db, "playlists"), {
        name: newPlaylistName,
        createdAt: new Date(),
        songs: [id] // On met l'ID du chant actuel
      });

      alert(`Playlist "${newPlaylistName}" créée avec le chant ! 🎉`);
      setShowModal(false);
      setPlaylists([]); // On vide le cache pour forcer le rechargement la prochaine fois
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la création");
    }
  };

  // --- Rendu Musical ---
  let contentDisplay = null;
  if (status === 'SUCCESS' && song) {
    try {
      const lines = parseChordPro(song.contenu);
      contentDisplay = lines.map((line: any[], i: number) => (
        <div key={i} className={`flex flex-wrap items-end mb-4 font-mono leading-relaxed transition-all ${!showChords ? 'min-h-[auto] mb-2' : 'min-h-[2.8em]'}`}>
          {line.map((token, j) => {
            let displayValue = token.value;
            if (showChords && token.type === 'chord' && token.originalChord) {
               displayValue = transposeChord(token.originalChord, semitones, preferFlat);
            }
            if (token.type === 'header') return <div key={j} className="w-full mt-6 mb-2 font-sans font-bold text-orange-600 uppercase border-b border-orange-100">{token.value}</div>;
            if (token.type === 'comment') return <div key={j} className="w-full text-gray-500 italic mb-1 text-sm bg-gray-50 p-1 rounded">{token.value}</div>;
            if (token.type === 'space') return <div key={j} className="w-full h-4"></div>;

            return (
              <div key={j} className="flex flex-col mr-1">
                 {showChords && token.type === 'chord' && (
                   <span className="font-bold text-red-600 text-[0.9em] mb-1 select-none leading-none h-[1.2em]">{displayValue}</span>
                 )}
                 {token.type === 'lyrics' && <span className="text-slate-800">{token.value}</span>}
              </div>
            );
          })}
        </div>
      ));
    } catch (renderError) { contentDisplay = <div>Erreur</div>; }
  }

  if (status === 'LOADING') return <div className="flex h-screen items-center justify-center text-gray-500">Chargement...</div>;
  if (status === 'ERROR') return <div className="p-8 text-center text-red-600">{errorMessage} <br/><Link href="/" className="underline">Retour</Link></div>;

  return (
    <div className="min-h-screen bg-white pb-32 text-slate-800">
      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600"><IconBack /></Link>
        <div className="flex-1 overflow-hidden">
          <h1 className="text-lg font-bold truncate text-slate-900">{song?.titre}</h1>
          <p className="text-xs text-orange-600 truncate font-medium">{song?.artiste}</p>
        </div>
        
        {/* Actions Header */}
        <button onClick={openPlaylistModal} className="p-2 rounded-full hover:bg-orange-50 text-gray-400 hover:text-orange-600 transition-colors">
            <IconPlaylistAdd />
        </button>
        <Link href={`/edit/${id}`} className="p-2 rounded-full hover:bg-orange-50 text-gray-400 hover:text-orange-600 transition-colors">
            <IconEdit />
        </Link>
      </header>

      {/* CONTROLS */}
      <div className="bg-gray-50 border-b border-gray-200 sticky top-[61px] z-10 overflow-x-auto no-scrollbar py-2 px-4 flex gap-3">
         <div className="flex bg-white rounded border shadow-sm h-9 items-center">
            <button onClick={() => setSemitones(s => s - 1)} className="px-3 h-full border-r font-bold hover:bg-gray-50 text-slate-600">-</button>
            <button onClick={() => setSemitones(0)} className="px-2 h-full text-xs font-mono text-gray-500">Key</button>
            <button onClick={() => setSemitones(s => s + 1)} className="px-3 h-full border-l font-bold hover:bg-gray-50 text-slate-600">+</button>
         </div>
         <button onClick={() => setShowChords(!showChords)} className={`px-3 h-9 rounded border shadow-sm text-sm font-bold transition-colors ${showChords ? 'bg-orange-600 text-white border-orange-700' : 'bg-white text-gray-700'}`}>
            {showChords ? 'ON' : 'OFF'}
         </button>
         <div className="flex bg-white rounded border shadow-sm h-9 items-center ml-auto">
            <button onClick={() => setFontSize(s => Math.max(12, s - 2))} className="px-3 h-full border-r font-bold hover:bg-gray-50 text-slate-600 text-xs">A-</button>
            <button onClick={() => setFontSize(s => Math.min(32, s + 2))} className="px-3 h-full font-bold hover:bg-gray-50 text-slate-600 text-xs">A+</button>
         </div>
      </div>

      <main className="p-4 md:p-8" style={{ fontSize: `${fontSize}px` }}>
        {contentDisplay}
        <div className="mt-12 pt-8 border-t border-gray-100 text-center pb-8">
            <p className="text-gray-400 text-sm italic">© {song?.artiste}</p>
            {song?.categorie && <span className="inline-block mt-2 px-3 py-1 bg-gray-50 text-gray-500 text-xs rounded-full border">{song.categorie}</span>}
        </div>
      </main>

      {/* MODAL PLAYLIST */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                    <h3 className="font-bold text-slate-800">Ajouter à une liste</h3>
                    <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                {/* Section Création Rapide */}
                <div className="p-3 border-b border-gray-100 bg-orange-50/50 flex-shrink-0">
                    {!isCreating ? (
                        <button 
                            onClick={() => setIsCreating(true)}
                            className="w-full py-2 border-2 border-dashed border-orange-200 text-orange-600 font-bold rounded-xl hover:bg-orange-100 transition-colors text-sm"
                        >
                            + Nouvelle Playlist
                        </button>
                    ) : (
                        <form onSubmit={createAndAdd} className="flex gap-2">
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Nom de la liste..." 
                                className="flex-1 px-3 py-2 rounded-lg border border-orange-200 text-sm outline-none focus:ring-2 focus:ring-orange-200 text-slate-800"
                                value={newPlaylistName}
                                onChange={e => setNewPlaylistName(e.target.value)}
                            />
                            <button type="submit" className="bg-orange-600 text-white px-3 py-2 rounded-lg font-bold text-xs">OK</button>
                            <button type="button" onClick={() => setIsCreating(false)} className="text-gray-400 px-2 text-lg">×</button>
                        </form>
                    )}
                </div>
                
                {/* Liste existante (Scrollable) */}
                <div className="overflow-y-auto p-2 flex-1">
                    {loadingPlaylists ? (
                        <p className="text-center py-8 text-gray-400">Chargement...</p>
                    ) : playlists.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-400 text-sm">Aucune playlist existante.</p>
                        </div>
                    ) : (
                        playlists.map(pl => (
                            <button 
                                key={pl.id}
                                onClick={() => addToPlaylist(pl.id, pl.name)}
                                className="w-full text-left p-3 hover:bg-orange-50 rounded-xl flex items-center justify-between group transition-colors border-b border-gray-50 last:border-0"
                            >
                                <span className="font-bold text-slate-700 group-hover:text-orange-700">{pl.name}</span>
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full group-hover:bg-orange-100 group-hover:text-orange-700">
                                    {pl.songs?.length || 0}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}