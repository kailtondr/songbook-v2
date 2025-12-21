// Fichier: app/edit/[id]/page.tsx
'use client';

import { useState, useEffect, use, useRef } from 'react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ChordToolbar from '@/components/music/ChordToolbar';
import { cleanupChorusTags } from '@/lib/musicEngine';
import { searchYoutubeAction } from '@/app/actions/youtube'; 

const IconMagic = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
);

export default function EditSong({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingYt, setSearchingYt] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [titre, setTitre] = useState('');
  const [artiste, setArtiste] = useState('');
  const [cle, setCle] = useState('C');
  const [contenu, setContenu] = useState('');
  const [categorie, setCategorie] = useState('');
  const [youtube, setYoutube] = useState('');
  const [audio, setAudio] = useState('');

  // 1. Charger
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "songs", id);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
          const data = snap.data();
          setTitre(data.titre || '');
          setArtiste(data.artiste || '');
          setCle(data.cle || 'C');
          setContenu(data.contenu || '');
          setCategorie(data.categorie || '');
          setYoutube(data.youtube || '');
          setAudio(data.audio || '');
        } else {
          alert("Chant introuvable");
          router.push('/');
        }
      } catch (e) {
        console.error("Erreur chargement:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, router]);

  // --- RECHERCHE YOUTUBE VIA LIBRAIRIE ---
  const autoFillYoutube = async () => {
    if (!titre) return alert("Remplissez d'abord le titre.");
    
    if (youtube && !confirm("Un lien existe déjà. Remplacer par le premier résultat trouvé ?")) return;

    setSearchingYt(true);
    try {
        // Cette action utilise maintenant 'yt-search' sur le serveur
        const foundUrl = await searchYoutubeAction(artiste, titre);
        
        if (foundUrl) {
            setYoutube(foundUrl);
        } else {
            // Ne devrait quasiment jamais arriver avec yt-search
            if(confirm("Aucune vidéo trouvée. Ouvrir YouTube manuellement ?")) {
                searchYoutubeManual();
            }
        }
    } catch (e) {
        console.error("Erreur autoFill:", e);
        searchYoutubeManual();
    } finally {
        setSearchingYt(false);
    }
  };

  const searchYoutubeManual = () => {
    const query = encodeURIComponent(`${artiste} ${titre}`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
  };

  const applyAutoFix = () => {
    const fixed = cleanupChorusTags(contenu);
    if (fixed !== contenu) { 
        setContenu(fixed); 
        alert("Refrains corrigés ! 🪄"); 
    } else { 
        alert("Aucune correction nécessaire."); 
    }
  };

  const handleInsert = (textToInsert: string, cursorOffset = 0) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const previousValue = textarea.value;
    const newValue = previousValue.substring(0, start) + textToInsert + previousValue.substring(end);
    setContenu(newValue);
    setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + textToInsert.length - cursorOffset;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleAudioBlur = () => {
    let url = audio.trim();
    if (url.includes('/s/') && !url.includes('/download')) {
      if (url.endsWith('/')) url = url.slice(0, -1);
      url += '/download';
      setAudio(url);
    }
  };

  const handleUpdate = async () => {
    if (!titre || !contenu) return alert("Le titre et le contenu sont requis");
    setSaving(true);
    try {
      const docRef = doc(db, "songs", id);
      await updateDoc(docRef, {
        titre, artiste, cle, contenu, categorie, youtube, audio,
        updatedAt: new Date()
      });
      router.push(`/song/${id}`);
    } catch (e) {
      alert("Erreur lors de la modification");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Supprimer définitivement ?")) {
      try {
        await deleteDoc(doc(db, "songs", id));
        router.push('/');
      } catch (e) { alert("Erreur suppression"); }
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500 dark:text-gray-400">Chargement...</div>;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 sticky top-0 z-30 px-4 py-3 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
        <Link href={`/song/${id}`} className="text-gray-500 dark:text-gray-400 font-bold text-sm">Annuler</Link>
        <h1 className="font-bold text-slate-800 dark:text-white">Modifier</h1>
        <button onClick={handleUpdate} disabled={saving} className="text-orange-600 dark:text-orange-400 font-bold text-sm disabled:opacity-50">
            {saving ? '...' : 'Sauvegarder'}
        </button>
      </header>

      <ChordToolbar content={contenu} onInsert={handleInsert} />

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 space-y-3">
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Titre</label>
                <input type="text" className="w-full text-lg font-bold border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent"
                    value={titre} onChange={e => setTitre(e.target.value)} />
            </div>
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Artiste</label>
                    <input type="text" className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent"
                        value={artiste} onChange={e => setArtiste(e.target.value)} />
                </div>
                <div className="w-24">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Clé</label>
                    <select className="w-full text-sm font-bold border-b border-gray-200 dark:border-slate-700 pb-2 bg-transparent text-slate-800 dark:text-white outline-none"
                        value={cle} onChange={e => setCle(e.target.value)}>
                        {["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"].map(k => <option key={k} value={k} className="dark:bg-slate-800">{k}</option>)}
                    </select>
                </div>
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Catégorie</label>
                <input type="text" className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent"
                    value={categorie} onChange={e => setCategorie(e.target.value)} />
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase flex items-center gap-2">
                <span>🎵 Liens Multimédia</span>
            </h3>
            
            {/* YOUTUBE */}
            <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Lien YouTube</label>
                <div className="flex gap-2">
                    <input type="text" placeholder="https://youtube.com/..." 
                        className="flex-1 text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600"
                        value={youtube} onChange={e => setYoutube(e.target.value)} />
                    
                    <button 
                        type="button" 
                        onClick={autoFillYoutube} 
                        disabled={searchingYt}
                        className="bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 text-orange-600 dark:text-orange-400 p-2 rounded-lg transition-colors flex items-center justify-center min-w-[36px]"
                        title="Trouver automatiquement la vidéo"
                    >
                        {searchingYt ? (
                            <div className="w-4 h-4 border-2 border-orange-600/30 border-t-orange-600 rounded-full animate-spin"></div>
                        ) : (
                            <IconMagic />
                        )}
                    </button>
                    
                    <button type="button" onClick={searchYoutubeManual} className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-600 dark:text-gray-400 p-2 rounded-lg transition-colors" title="Ouvrir YouTube">🔍</button>
                </div>
            </div>

            <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Lien Audio (MP3/Nextcloud)</label>
                <input type="text" placeholder="https://..." 
                    className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600"
                    value={audio} onChange={e => setAudio(e.target.value)} onBlur={handleAudioBlur} 
                />
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col h-[60vh]">
            <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Paroles et Accords</label>
                <button 
                    onClick={applyAutoFix}
                    className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-lg font-bold hover:bg-orange-200 transition-colors"
                >
                    🪄 Corriger *
                </button>
            </div>
            
            <textarea 
                ref={textareaRef}
                className="flex-1 w-full font-mono text-sm leading-relaxed p-2 bg-gray-50 dark:bg-slate-950 rounded-lg border border-transparent outline-none resize-none text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/20"
                value={contenu} 
                onChange={e => setContenu(e.target.value)}
            ></textarea>
        </div>

        <div className="pt-4">
            <button onClick={handleDelete} className="w-full py-3 text-red-600 dark:text-red-400 font-bold bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 text-sm">
                Supprimer ce chant
            </button>
        </div>

      </div>
    </main>
  );
}