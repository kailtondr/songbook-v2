'use client';

import { useState, useEffect, use, useRef } from 'react';
import { doc, getDoc, updateDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation'; // Ajout useSearchParams
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
  const searchParams = useSearchParams();
  const isReviewMode = searchParams.get('reviewMode') === 'true'; // Détection mode revue

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingYt, setSearchingYt] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Champs
  const [titre, setTitre] = useState('');
  const [artiste, setArtiste] = useState('');
  const [cle, setCle] = useState('C');
  const [contenu, setContenu] = useState('');
  const [categorie, setCategorie] = useState('');
  const [mass, setMass] = useState(''); 
  const [youtube, setYoutube] = useState('');
  const [audio, setAudio] = useState('');
  const [reviewed, setReviewed] = useState(false); // NOUVEAU

  // Suggestions
  const [existingMasses, setExistingMasses] = useState<string[]>([]);
  const [existingArtists, setExistingArtists] = useState<string[]>([]);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);

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
          setMass(data.mass || ''); 
          setYoutube(data.youtube || '');
          setAudio(data.audio || '');
          setReviewed(data.reviewed || false); // Charge l'état
        } else {
          alert("Chant introuvable");
          router.push('/'); return;
        }

        const allSongsSnap = await getDocs(collection(db, "songs"));
        const uniqueMasses = new Set<string>();
        const uniqueArtists = new Set<string>();
        const uniqueCategories = new Set<string>();

        allSongsSnap.docs.forEach(doc => {
            const d = doc.data();
            if (d.mass?.trim()) uniqueMasses.add(d.mass.trim());
            if (d.artiste?.trim()) uniqueArtists.add(d.artiste.trim());
            if (d.categorie?.trim()) uniqueCategories.add(d.categorie.trim());
        });

        setExistingMasses(Array.from(uniqueMasses).sort());
        setExistingArtists(Array.from(uniqueArtists).sort());
        setExistingCategories(Array.from(uniqueCategories).sort());

      } catch (e) { console.error("Erreur chargement:", e); } finally { setLoading(false); }
    };
    fetchData();
  }, [id, router]);

  const autoFillYoutube = async () => { /* ... (Code inchangé) ... */ 
    if (!titre) return alert("Remplissez d'abord le titre.");
    if (youtube && !confirm("Remplacer lien ?")) return;
    setSearchingYt(true);
    try {
        const foundUrl = await searchYoutubeAction(artiste, titre);
        if (foundUrl) setYoutube(foundUrl);
        else if(confirm("Rien trouvé. Chercher manuellement ?")) searchYoutubeManual();
    } catch (e) { searchYoutubeManual(); } finally { setSearchingYt(false); }
  };

  const searchYoutubeManual = () => {
    const query = encodeURIComponent(`${artiste} ${titre}`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
  };

  const applyAutoFix = () => {
    const fixed = cleanupChorusTags(contenu);
    if (fixed !== contenu) { setContenu(fixed); alert("Refrains corrigés ! 🪄"); } 
    else { alert("Aucune correction nécessaire."); }
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
      setAudio(url + '/download');
    }
  };

  // SAUVEGARDE STANDARD
  const handleUpdate = async (markAsReviewed = false) => {
    if (!titre || !contenu) return alert("Le titre et le contenu sont requis");
    setSaving(true);
    try {
      const docRef = doc(db, "songs", id);
      await updateDoc(docRef, {
        titre, artiste, cle, contenu, categorie, mass, youtube, audio,
        reviewed: markAsReviewed ? true : reviewed, // Mise à jour du statut
        updatedAt: new Date()
      });
      
      if (isReviewMode) {
          router.push('/review'); // Retour au dashboard si mode revue
      } else {
          router.push(`/song/${id}`);
      }
    } catch (e) { alert("Erreur sauvegarde"); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (confirm("Supprimer définitivement ?")) {
      try { await deleteDoc(doc(db, "songs", id)); router.push('/'); } catch (e) { alert("Erreur suppression"); }
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">Chargement...</div>;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 transition-colors duration-300">
      
      {/* HEADER FIXE */}
      <div className="sticky top-0 z-40 bg-gray-50 dark:bg-slate-950 shadow-sm">
          <header className="bg-white dark:bg-slate-900 px-4 py-3 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
            <button onClick={() => router.back()} className="text-gray-500 dark:text-gray-400 font-bold text-sm">Annuler</button>
            <h1 className="font-bold text-slate-800 dark:text-white">{isReviewMode ? 'Mode Revue 🧐' : 'Modifier'}</h1>
            <div className="flex gap-2">
                {/* BOUTON SAUVEGARDE SIMPLE */}
                <button onClick={() => handleUpdate(false)} disabled={saving} className="text-gray-400 font-bold text-sm disabled:opacity-50">
                    Sauver
                </button>
                {/* BOUTON VALIDATION (Mis en avant) */}
                <button onClick={() => handleUpdate(true)} disabled={saving} className="bg-green-100 text-green-700 px-3 py-1 rounded-lg font-bold text-xs uppercase tracking-wide hover:bg-green-200 transition-colors disabled:opacity-50">
                    {saving ? '...' : '✅ Valider'}
                </button>
            </div>
          </header>
          <ChordToolbar content={contenu} onInsert={handleInsert} />
      </div>

      <div className="p-4 space-y-4 w-full">
        
        {/* BANDEAU SI DEJA VALIDE */}
        {reviewed && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-center text-sm font-bold">
                Ce chant est marqué comme validé ✅
            </div>
        )}

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Titre</label>
                <input type="text" className="w-full text-lg font-bold border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent"
                    value={titre} onChange={e => setTitre(e.target.value)} />
            </div>
            <div>
                <label className="block text-xs font-bold text-orange-600 mb-1 uppercase">Ordinaire / Collection</label>
                <input type="text" list="masses-suggestions" className="w-full text-sm font-bold border-b border-orange-200 dark:border-orange-900/50 pb-2 outline-none text-slate-800 dark:text-white bg-transparent"
                    value={mass} onChange={e => setMass(e.target.value)} />
                <datalist id="masses-suggestions">{existingMasses.map(m => <option key={m} value={m} />)}</datalist>
            </div>
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Artiste</label>
                    <input type="text" list="artists-suggestions" className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent"
                        value={artiste} onChange={e => setArtiste(e.target.value)} />
                    <datalist id="artists-suggestions">{existingArtists.map(a => <option key={a} value={a} />)}</datalist>
                </div>
                <div className="w-24">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Clé</label>
                    <select className="w-full text-sm font-bold border-b border-gray-200 dark:border-slate-700 pb-2 bg-transparent text-slate-800 dark:text-white outline-none"
                        value={cle} onChange={e => setCle(e.target.value)}>
                        {["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"].map(k => <option key={k} value={k} className="dark:bg-slate-800">{k}</option>)}
                    </select>
                </div>
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Catégorie</label>
                <input type="text" list="categories-suggestions" className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent"
                    value={categorie} onChange={e => setCategorie(e.target.value)} />
                <datalist id="categories-suggestions">{existingCategories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><span>🎵 Liens</span></h3>
            <div className="flex gap-2">
                <input type="text" placeholder="YouTube..." className="flex-1 text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none bg-transparent dark:text-white"
                    value={youtube} onChange={e => setYoutube(e.target.value)} />
                <button type="button" onClick={autoFillYoutube} disabled={searchingYt} className="bg-orange-100 text-orange-600 p-2 rounded-lg">{searchingYt ? '...' : <IconMagic />}</button>
            </div>
            <input type="text" placeholder="Audio..." className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none bg-transparent dark:text-white"
                value={audio} onChange={e => setAudio(e.target.value)} onBlur={handleAudioBlur} />
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col min-h-[85vh]">
            <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-500 uppercase">Paroles</label>
                <button onClick={applyAutoFix} className="text-[10px] bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-bold">🪄 Corriger *</button>
            </div>
            <textarea ref={textareaRef} className="flex-1 w-full font-mono text-sm leading-relaxed p-2 bg-gray-50 dark:bg-slate-950 rounded-lg border border-transparent outline-none resize-none text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/20"
                value={contenu} onChange={e => setContenu(e.target.value)}></textarea>
        </div>

        <div className="pt-4 pb-20">
            <button onClick={handleDelete} className="w-full py-3 text-red-600 font-bold bg-white dark:bg-slate-900 border border-red-100 rounded-xl text-sm">Supprimer</button>
        </div>
      </div>
    </main>
  );
}