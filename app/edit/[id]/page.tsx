'use client';

import { useState, useEffect, useRef, Suspense, use } from 'react';
import { doc, getDoc, updateDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ChordToolbar from '@/components/music/ChordToolbar';
import { cleanupChorusTags } from '@/lib/musicEngine';
import { searchYoutubeAction } from '@/app/actions/youtube'; 
import { exportData } from '@/lib/backupService';

// ==========================================
// 1. MOTEURS DE CONVERSION (VISUEL <-> CHORDPRO)
// ==========================================

// --- Helper de nettoyage (nécessaire pour le Smart Paste) ---
const sanitizeImportText = (text: string) => {
    let cleaned = text;
    cleaned = cleaned.replace(/\t/g, "    ");
    cleaned = cleaned.replace(/[¨]/g, ""); 
    cleaned = cleaned.replace(/[|]/g, " "); 
    cleaned = cleaned.replace(/ – /g, " "); 
    cleaned = cleaned.replace(/ - /g, " "); 
    cleaned = cleaned.replace(/([A-G][b#]?)–([A-G])/g, "$1 $2"); 
    cleaned = cleaned.replace(/([A-G][b#]?)-([A-G])/g, "$1 $2");

    const lines = cleaned.split('\n');
    let result = [];
    let insideChorus = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].replace(/\s+$/, ''); 
        // Détection Refrain simple si pas encore balisé
        if (line.match(/^(chorus|refrain|refr)/i) && !line.includes('{')) {
            if (insideChorus) result.push('{eoc}');
            result.push('{soc}');
            insideChorus = true;
            continue;
        }
        if (insideChorus && line.trim() === '') {
            result.push('{eoc}');
            insideChorus = false;
        }
        result.push(line);
    }
    if (insideChorus) result.push('{eoc}');
    return result.join('\n');
};

// --- ChordPro vers Visuel (Accords au-dessus) ---
const convertChordProToVisual = (text: string) => {
    const lines = text.split('\n');
    let output: string[] = [];
    const chordRegex = /\[([A-G][^\]]*)\]/g;

    lines.forEach(line => {
        if (!line.includes('[')) {
            output.push(line);
            return;
        }

        let chordLine = "";
        const pureLyrics = line.replace(chordRegex, "");
        // Large buffer pour éviter les débordements
        let chordLineChars = new Array(Math.max(pureLyrics.length, line.length) + 200).fill(" "); 

        let match;
        let lastPos = 0; 

        while ((match = chordRegex.exec(line)) !== null) {
            const chord = match[1]; 
            const indexInSource = match.index;
            const partBefore = line.substring(0, indexInSource);
            const anchorPos = partBefore.replace(/\[.*?\]/g, "").length;
            
            // Anti-collision : on écrit après le dernier accord
            let writePos = Math.max(anchorPos, lastPos);

            for (let i = 0; i < chord.length; i++) {
                chordLineChars[writePos + i] = chord[i];
            }
            lastPos = writePos + chord.length + 1;
        }
        
        chordLine = chordLineChars.join("").trimEnd();
        if (chordLine.length > 0) output.push(chordLine);
        output.push(pureLyrics);
    });

    return output.join('\n');
};

// --- Visuel vers ChordPro (Moteur Intelligent) ---
const convertVisualToChordPro = (text: string) => {
    const lines = text.split('\n');
    let result: string[] = [];

    // Regex Hybride complet
    const smartChordRegex = /^([A-G][b#♯♭]?)((?:m|M|maj|min|dim|aug|sus|add|°|ø|Δ|\+|-|\d|[()b#♯♭])*)(?:\/(?:[A-G][b#♯♭]?|[\d\+\-\(\)b#♯♭]+))?$/;
    const excludedWords = new Set(["a", "I", "Un", "Le", "La", "Les", "De", "Du", "En", "Et", "Est", "Agnus", "Avec"]);
    const cleanToken = (t: string) => t.replace(/^[\[\](){}<>.,;*:"']+|[\[\](){}<>.,;*:"']+$/g, '');

    function isLikelyChord(token: string) {
        const clean = cleanToken(token);
        if (!clean) return false;
        if (/^\d{1,2}\/\d{1,2}$/.test(clean)) return false; 
        if (excludedWords.has(clean)) return false;
        return smartChordRegex.test(clean);
    }

    function isChordLine(line: string) {
        const cleanLine = line.trim();
        if (!cleanLine) return false;
        if (cleanLine.startsWith('{')) return false; 
        const tokens = cleanLine.split(/\s+/);
        let chordCount = 0;
        let invalidCount = 0;
        tokens.forEach(token => {
            const stripped = cleanToken(token);
            if (!stripped) return; 
            if (/^(intr|intro|final|pont|bridge|coda|couplet|verse|chorus|refrain)[:.]?$/i.test(stripped)) return;
            if (/^[|%/:xX\-_]+$/.test(token)) return; 
            if (isLikelyChord(stripped)) chordCount++; else invalidCount++;
        });
        return chordCount > 0 && chordCount >= invalidCount;
    }

    for (let i = 0; i < lines.length; i++) {
        let currentLine = lines[i]; 
        if (isChordLine(currentLine)) {
            const isNextLineLyrics = (i + 1 < lines.length) && (lines[i + 1].trim() !== '') && (!isChordLine(lines[i + 1])) && (!lines[i + 1].trim().startsWith('{'));
            if (isNextLineLyrics) {
                let lyricLine = lines[i + 1];
                const tokenMatches = [...currentLine.matchAll(/\S+/g)];
                let combinedLine = lyricLine;
                for (let j = tokenMatches.length - 1; j >= 0; j--) {
                    const match = tokenMatches[j];
                    const token = match[0];
                    const index = match.index || 0; 
                    const stripped = cleanToken(token);
                    if (isLikelyChord(stripped)) {
                        let chord = `[${stripped}]`;
                        if (index >= combinedLine.length) combinedLine = combinedLine.padEnd(index, ' ') + chord;
                        else combinedLine = combinedLine.slice(0, index) + chord + combinedLine.slice(index);
                    }
                }
                result.push(combinedLine.trimRight());
                i++; 
            } else {
                const processed = currentLine.replace(/\S+/g, (t) => {
                    const s = cleanToken(t);
                    return isLikelyChord(s) && !t.includes('[') ? `[${s}]` : t;
                });
                result.push(processed);
            }
        } else {
            result.push(currentLine);
        }
    }
    return result.join('\n');
};

// ==========================================
// 2. COMPOSANT UI
// ==========================================

function EditSongContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  const isReviewMode = searchParams.get('reviewMode') === 'true';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingYt, setSearchingYt] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [titre, setTitre] = useState('');
  const [artiste, setArtiste] = useState('');
  const [cle, setCle] = useState('C');
  const [contenu, setContenu] = useState('');
  const [categorie, setCategorie] = useState('');
  const [mass, setMass] = useState(''); 
  const [youtube, setYoutube] = useState('');
  const [audio, setAudio] = useState('');
  const [reviewed, setReviewed] = useState(false);

  const [isVisualMode, setIsVisualMode] = useState(false);

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
          setReviewed(data.reviewed || false);
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

  // --- HANDLERS ---

  // Import Intelligent depuis la Toolbar
  const handleSmartClipboard = async () => {
    try {
        const clipboardContent = await navigator.clipboard.readText();
        if (!clipboardContent || clipboardContent.trim() === '') { alert("Presse-papier vide !"); return; }

        if (isVisualMode) {
            alert("Veuillez repasser en mode 'Code' pour utiliser l'import intelligent.");
            return;
        }

        const sanitizedContent = sanitizeImportText(clipboardContent);
        // On réutilise le moteur visuel->chordpro pour la fusion
        const mergedContent = convertVisualToChordPro(sanitizedContent);
        
        if (contenu.trim() === '') {
            setContenu(mergedContent);
        } else {
            if(confirm("Ajouter à la suite du contenu existant ?")) {
                setContenu(prev => prev + "\n\n" + mergedContent);
            }
        }
        alert("📋 Contenu collé et converti !");
    } catch (err) { console.error(err); alert("Erreur d'accès au presse-papier."); }
  };

  const autoFillYoutube = async () => {
    if (!titre) return alert("Remplissez d'abord le titre.");
    if (youtube && !confirm("Remplacer le lien existant ?")) return;
    setSearchingYt(true);
    try {
        const foundUrl = await searchYoutubeAction(artiste, titre);
        if (foundUrl) { setYoutube(foundUrl); } 
        else { if(confirm("Aucune vidéo trouvée. Ouvrir YouTube manuellement ?")) searchYoutubeManual(); }
    } catch (e) { searchYoutubeManual(); } finally { setSearchingYt(false); }
  };
  const searchYoutubeManual = () => { const query = encodeURIComponent(`${artiste} ${titre}`); window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank'); };

  const applyAutoFix = () => {
    if (isVisualMode) { alert("Passez en mode 'Code' d'abord."); return; }
    const fixed = cleanupChorusTags(contenu);
    if (fixed !== contenu) { setContenu(fixed); alert("Corrigé !"); } else { alert("Rien à corriger."); }
  };

  const toggleVisualMode = () => {
      if (isVisualMode) {
          const proContent = convertVisualToChordPro(contenu);
          setContenu(proContent);
          setIsVisualMode(false);
      } else {
          const visualContent = convertChordProToVisual(contenu);
          setContenu(visualContent);
          setIsVisualMode(true);
      }
  };

  const handleInsert = (textToInsert: string, cursorOffset = 0) => {
    if (isVisualMode) { alert("Insertion désactivée en mode Visuel."); return; }
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const previousValue = textarea.value;
    const newValue = previousValue.substring(0, start) + textToInsert + previousValue.substring(end);
    setContenu(newValue);
    
    // CORRECTION MAJEURE : preventScroll empêche la page de sauter lors du focus
    setTimeout(() => {
        textarea.focus({ preventScroll: true }); 
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

  const handleUpdate = async (markAsReviewed = false) => {
    if (!titre || !contenu) return alert("Infos manquantes");
    let finalContenu = contenu;
    if (isVisualMode) {
        if(!confirm("Conversion en format standard avant sauvegarde ?")) return;
        finalContenu = convertVisualToChordPro(contenu);
        setContenu(finalContenu); setIsVisualMode(false);
    }
    setSaving(true);
    try {
      const docRef = doc(db, "songs", id);
      await updateDoc(docRef, { titre, artiste, cle, contenu: finalContenu, categorie, mass, youtube, audio, reviewed: markAsReviewed ? true : reviewed, updatedAt: new Date() });
      if (isReviewMode) { router.push('/review'); } else { router.push(`/song/${id}`); }
    } catch (e) { alert("Erreur sauvegarde"); } finally { setSaving(false); }
  };

  const handleExport = () => { exportData('single', id); };
  const handleDelete = async () => { if (confirm("Supprimer ?")) { try { await deleteDoc(doc(db, "songs", id)); router.push('/'); } catch (e) { alert("Erreur suppression"); } } };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">Chargement...</div>;
  const yId = (url: string) => { if (!url) return null; const m = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/); return (m && m[2].length === 11) ? m[2] : null; };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 transition-colors duration-300">
      
      {/* HEADER + TOOLBAR (Sticky Fixe Z-50) */}
      <div className="sticky top-0 z-50 bg-gray-50 dark:bg-slate-950 shadow-md">
          <header className="bg-white dark:bg-slate-900 px-4 py-3 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()} className="text-gray-500 dark:text-gray-400 font-bold text-sm">Annuler</button>
                <button onClick={handleExport} className="p-1.5 text-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 transition-colors" title="Exporter JSON"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
            </div>
            <h1 className="font-bold text-slate-800 dark:text-white truncate max-w-[150px]">{isReviewMode ? 'Mode Revue' : 'Modifier'}</h1>
            <div className="flex gap-2">
                <button onClick={() => handleUpdate(false)} disabled={saving} className="text-gray-400 font-bold text-sm disabled:opacity-50">Sauver</button>
                <button onClick={() => handleUpdate(true)} disabled={saving} className="bg-green-100 text-green-700 px-3 py-1 rounded-lg font-bold text-xs uppercase hover:bg-green-200 disabled:opacity-50">{saving ? '...' : '✅ Valider'}</button>
            </div>
          </header>
          
          {/* BARRE D'OUTILS (Masquée en mode visuel) */}
          {!isVisualMode && <ChordToolbar content={contenu} onInsert={handleInsert} onSmartPaste={handleSmartClipboard} />}
      </div>

      <div className="p-4 space-y-4 w-full">
        {reviewed && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-center text-sm font-bold">Chant validé ✅</div>}

        {/* METADATA */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
            <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Titre</label><input type="text" className="w-full text-lg font-bold border-b border-gray-200 dark:border-slate-700 pb-2 bg-transparent text-slate-800 dark:text-white outline-none" value={titre} onChange={e => setTitre(e.target.value)} /></div>
            <div><label className="block text-xs font-bold text-orange-600 dark:text-orange-400 mb-1 uppercase flex justify-between"><span>Ordinaire</span><span className="text-[9px] opacity-70 font-normal normal-case">Ex: Messe...</span></label><input type="text" list="masses-suggestions" className="w-full text-sm font-bold border-b border-orange-200 dark:border-orange-900/50 pb-2 bg-transparent text-slate-800 dark:text-white outline-none" value={mass} onChange={e => setMass(e.target.value)} /><datalist id="masses-suggestions">{existingMasses.map(m => <option key={m} value={m} />)}</datalist></div>
            <div className="flex gap-3">
                <div className="flex-1"><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Artiste</label><input type="text" list="artists-suggestions" className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 bg-transparent text-slate-800 dark:text-white outline-none" value={artiste} onChange={e => setArtiste(e.target.value)} /><datalist id="artists-suggestions">{existingArtists.map(a => <option key={a} value={a} />)}</datalist></div>
                <div className="w-24"><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Clé</label><select className="w-full text-sm font-bold border-b border-gray-200 dark:border-slate-700 pb-2 bg-transparent text-slate-800 dark:text-white outline-none" value={cle} onChange={e => setCle(e.target.value)}>{["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"].map(k => <option key={k} value={k} className="dark:bg-slate-800">{k}</option>)}</select></div>
            </div>
             <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Catégorie</label><input type="text" list="categories-suggestions" className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 bg-transparent text-slate-800 dark:text-white outline-none" value={categorie} onChange={e => setCategorie(e.target.value)} /><datalist id="categories-suggestions">{existingCategories.map(c => <option key={c} value={c} />)}</datalist></div>
        </div>

        {/* MEDIA */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase flex items-center gap-2"><span>🎵 Liens</span></h3>
            <div><label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">YouTube</label><div className="flex gap-2"><input type="text" className="flex-1 text-sm border-b border-gray-200 dark:border-slate-700 pb-2 bg-transparent text-slate-800 dark:text-white outline-none" value={youtube} onChange={e => setYoutube(e.target.value)} /><button onClick={autoFillYoutube} disabled={searchingYt} className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 p-2 rounded-lg">{searchingYt ? '...' : '🪄'}</button><button onClick={searchYoutubeManual} className="bg-gray-100 dark:bg-slate-800 text-gray-600 p-2 rounded-lg">🔍</button></div></div>
            {yId(youtube) && (<div className="relative w-full rounded-lg overflow-hidden bg-black aspect-video shadow-md border border-gray-200 dark:border-slate-700"><iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${yId(youtube)}?rel=0&playsinline=1`} allowFullScreen></iframe></div>)}
            <div><label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Audio</label><input type="text" className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 bg-transparent text-slate-800 dark:text-white outline-none" value={audio} onChange={e => setAudio(e.target.value)} onBlur={handleAudioBlur} /></div>
        </div>

        {/* PAROLES */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col min-h-[85vh]">
            <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Paroles {isVisualMode ? '(Visuel)' : '(Code)'}</label>
                <div className="flex gap-2">
                    <button onClick={toggleVisualMode} className={`text-[10px] px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 ${isVisualMode ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{isVisualMode ? '📝 Code' : '👁️ Visuel'}</button>
                    <button onClick={applyAutoFix} className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-lg font-bold hover:bg-orange-200 transition-colors">🪄 Corriger</button>
                </div>
            </div>
            <textarea ref={textareaRef} className={`flex-1 w-full font-mono text-sm leading-relaxed p-2 rounded-lg border outline-none resize-none ${isVisualMode ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-slate-800 dark:text-slate-200' : 'bg-gray-50 dark:bg-slate-950 border-transparent text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/20'}`} value={contenu} onChange={e => setContenu(e.target.value)} placeholder={isVisualMode ? "Ajustez..." : "[G]Dieu..."} wrap={isVisualMode ? "off" : "soft"}></textarea>
            {isVisualMode && <p className="text-[10px] text-blue-600 mt-2 text-center animate-pulse">💡 Déplacez les accords avec des espaces.</p>}
        </div>

        <div className="pt-4"><button onClick={handleDelete} className="w-full py-3 text-red-600 dark:text-red-400 font-bold bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 text-sm">Supprimer</button></div>
      </div>
    </main>
  );
}

export default function EditSongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500">Chargement de l'éditeur...</div>}>
      <EditSongContent id={id} />
    </Suspense>
  );
}