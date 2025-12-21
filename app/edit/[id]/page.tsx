'use client';

import { useState, useEffect, use, useRef } from 'react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ChordToolbar from '@/components/music/ChordToolbar';
import { cleanupChorusTags } from '@/lib/musicEngine'; // <-- IMPORT

export default function EditSong({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Champs
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

  // FONCTION : Nettoyage Automatique
  const applyAutoFix = () => {
    const fixed = cleanupChorusTags(contenu);
    if (fixed !== contenu) {
        setContenu(fixed);
        // Petit effet visuel pour confirmer (optionnel)
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

  const searchYoutube = () => {
    if (!titre) return alert("Entrez d'abord un titre.");
    const query = encodeURIComponent(`${artiste} ${titre}`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
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
            
            <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Lien YouTube</label>
                <div className="flex gap-2">
                    <input type="text" placeholder="https://youtube.com/..." 
                        className="flex-1 text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600"
                        value={youtube} onChange={e => setYoutube(e.target.value)} />
                    <button type="button" onClick={searchYoutube} className="bg-gray-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400 hover:text-orange-600 p-2 rounded-lg transition-colors">🔍</button>
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
                
                {/* BOUTON MAGIQUE AUTO-FIX */}
                <button 
                    onClick={applyAutoFix}
                    className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-lg font-bold hover:bg-orange-200 transition-colors"
                    title="Convertir les étoiles * en balises {soc}"
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