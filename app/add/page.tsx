'use client';

import { useState, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ChordToolbar from '@/components/music/ChordToolbar';
import { cleanupChorusTags } from '@/lib/musicEngine';

// --- Icône Baguette ---
const IconMagic = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;

export default function AddSong() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [searchingYt, setSearchingYt] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Champs du formulaire
  const [titre, setTitre] = useState('');
  const [artiste, setArtiste] = useState('');
  const [cle, setCle] = useState('C');
  const [contenu, setContenu] = useState('');
  const [categorie, setCategorie] = useState('');
  const [youtube, setYoutube] = useState('');
  const [audio, setAudio] = useState('');

  // --- SCRIPT : RECHERCHE YOUTUBE AUTO ---
  const autoFillYoutube = async () => {
    if (!titre) return alert("Remplissez d'abord le titre.");
    if (youtube && !confirm("Un lien existe déjà. Voulez-vous le remplacer ?")) return;

    setSearchingYt(true);
    try {
        const query = encodeURIComponent(`${artiste} ${titre} lyrics`);
        // Utilisation d'une instance publique Invidious pour l'API
        const response = await fetch(`https://invidious.jing.rocks/api/v1/search?q=${query}`);
        
        if (!response.ok) throw new Error("API inaccessible");
        
        const results = await response.json();

        if (results && results.length > 0) {
            const video = results.find((r: any) => r.type === 'video');
            
            if (video) {
                const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
                setYoutube(videoUrl);
            } else {
                alert("Aucune vidéo trouvée.");
            }
        } else {
            alert("Aucun résultat.");
        }
    } catch (e) {
        console.error(e);
        if(confirm("La recherche automatique a échoué. Ouvrir YouTube manuellement ?")) {
            searchYoutubeManual();
        }
    } finally {
        setSearchingYt(false);
    }
  };

  const searchYoutubeManual = () => {
    if (!titre) return alert("Remplissez d'abord le titre.");
    const query = encodeURIComponent(`${artiste} ${titre}`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
  };

  // --- FONCTIONS UTILS ---
  const applyAutoFix = () => {
    const fixed = cleanupChorusTags(contenu);
    if (fixed !== contenu) { setContenu(fixed); alert("Refrains corrigés ! 🪄"); } else { alert("Aucune correction nécessaire."); }
  };

  const handleInsert = (textToInsert: string, cursorOffset = 0) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = textarea.value.substring(0, start) + textToInsert + textarea.value.substring(end);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre || !contenu) return alert("Le titre et le contenu sont obligatoires");

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "songs"), {
        titre,
        artiste: artiste || "Inconnu",
        cle,
        contenu,
        categorie: categorie || "Divers",
        youtube,
        audio,
        createdAt: new Date()
      });
      router.push(`/song/${docRef.id}`);
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 sticky top-0 z-30 px-4 py-3 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
        <Link href="/" className="text-gray-500 dark:text-gray-400 font-bold text-sm">Annuler</Link>
        <h1 className="font-bold text-slate-800 dark:text-white">Nouveau Chant</h1>
        <button 
            onClick={handleSubmit} 
            disabled={loading}
            className="text-orange-600 dark:text-orange-400 font-bold text-sm disabled:opacity-50"
        >
            {loading ? '...' : 'Enregistrer'}
        </button>
      </header>

      {/* Import Rapide */}
      <div className="p-4 pb-0 max-w-lg mx-auto">
          <Link href="/import" className="block w-full py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-slate-600 dark:text-gray-300 font-bold text-center rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
              ⚡ Importer depuis le presse-papier
          </Link>
          <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-slate-800"></div></div>
              <span className="relative px-2 bg-gray-50 dark:bg-slate-950 text-xs text-gray-400 uppercase">Ou créer manuellement</span>
          </div>
      </div>

      {/* BARRE D'OUTILS ACCORDS */}
      <ChordToolbar content={contenu} onInsert={handleInsert} />

      <div className="p-4 space-y-4 max-w-lg mx-auto pt-0">
        
        {/* Infos Base */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 space-y-3">
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Titre</label>
                <input 
                    type="text" 
                    placeholder="Ex: Grâce Infinie" 
                    className="w-full text-lg font-bold border-b border-gray-200 dark:border-slate-700 pb-2 focus:border-orange-500 outline-none text-slate-800 dark:text-white bg-transparent"
                    value={titre}
                    onChange={e => setTitre(e.target.value)}
                />
            </div>
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Artiste</label>
                    <input 
                        type="text" 
                        placeholder="Ex: Hillsong" 
                        className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 focus:border-orange-500 outline-none text-slate-800 dark:text-white bg-transparent"
                        value={artiste}
                        onChange={e => setArtiste(e.target.value)}
                    />
                </div>
                <div className="w-24">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Clé</label>
                    <select 
                        className="w-full text-sm font-bold border-b border-gray-200 dark:border-slate-700 pb-2 bg-transparent text-slate-800 dark:text-white outline-none"
                        value={cle}
                        onChange={e => setCle(e.target.value)}
                    >
                        {["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"].map(k => (
                            <option key={k} value={k} className="dark:bg-slate-800">{k}</option>
                        ))}
                    </select>
                </div>
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Catégorie</label>
                <input 
                    type="text" 
                    placeholder="Ex: Louange, Adoration..." 
                    className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 focus:border-orange-500 outline-none text-slate-800 dark:text-white bg-transparent"
                    value={categorie}
                    onChange={e => setCategorie(e.target.value)}
                />
            </div>
        </div>

        {/* SECTION MULTIMÉDIA */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase flex items-center gap-2">
                <span>🎵 Liens Multimédia</span>
            </h3>
            
            {/* YOUTUBE : AVEC BOUTON MAGIQUE */}
            <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Lien YouTube</label>
                <div className="flex gap-2">
                    <input type="text" placeholder="https://youtube.com/..." 
                        className="flex-1 text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600"
                        value={youtube} onChange={e => setYoutube(e.target.value)} />
                    
                    {/* Bouton Baguette Magique (Auto) */}
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
                    
                    {/* Bouton Loupe (Manuel) */}
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

        {/* Paroles */}
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
                placeholder="[G]Dieu est [C]bon..."
                value={contenu}
                onChange={e => setContenu(e.target.value)}
            ></textarea>
        </div>

      </div>
    </main>
  );
}