'use client';

import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ChordToolbar from '@/components/music/ChordToolbar';
import { cleanupChorusTags } from '@/lib/musicEngine';
import { searchYoutubeAction } from '@/app/actions/youtube'; 
import { importSongFromUrlAction } from '@/app/actions/import';

// --- ICONS ---
const IconMagic = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;
const IconDownload = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
const IconUpload = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>;
const IconClipboard = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;

const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// --- NETTOYAGE PRÉALABLE ---
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

export default function AddSong() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [searchingYt, setSearchingYt] = useState(false);
  const [importingUrl, setImportingUrl] = useState(false);
  const [importUrl, setImportUrl] = useState(''); 
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); 
  
  const [titre, setTitre] = useState('');
  const [artiste, setArtiste] = useState('');
  const [cle, setCle] = useState('C');
  const [contenu, setContenu] = useState('');
  const [categorie, setCategorie] = useState('');
  const [mass, setMass] = useState('');
  const [youtube, setYoutube] = useState('');
  const [audio, setAudio] = useState('');

  const [existingMasses, setExistingMasses] = useState<string[]>([]);
  const [existingArtists, setExistingArtists] = useState<string[]>([]);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "songs"));
        const uniqueMasses = new Set<string>();
        const uniqueArtists = new Set<string>();
        const uniqueCategories = new Set<string>();

        querySnapshot.forEach(doc => {
            const d = doc.data();
            if (d.mass?.trim()) uniqueMasses.add(d.mass.trim());
            if (d.artiste?.trim()) uniqueArtists.add(d.artiste.trim());
            if (d.categorie?.trim()) uniqueCategories.add(d.categorie.trim());
        });

        setExistingMasses(Array.from(uniqueMasses).sort());
        setExistingArtists(Array.from(uniqueArtists).sort());
        setExistingCategories(Array.from(uniqueCategories).sort());
      } catch (e) { console.error("Erreur suggestions:", e); }
    };
    fetchSuggestions();
  }, []);

  // --- LOGIQUE IMPORT FICHIER CHORDPRO ---
  const triggerFileUpload = () => {
      if (fileInputRef.current) fileInputRef.current.click();
  };

  const parseChordProFile = (text: string) => {
      const lines = text.split('\n');
      let extractedTitle = "Sans titre";
      let extractedArtist = "";
      let extractedKey = "C";
      let cleanLines: string[] = [];

      lines.forEach(line => {
          const trim = line.trim();
          if (trim.startsWith('{t:') || trim.startsWith('{title:')) {
              extractedTitle = trim.replace(/{t:|{title:|}/g, '').trim();
          } else if (trim.startsWith('{a:') || trim.startsWith('{artist:')) {
              extractedArtist = trim.replace(/{a:|{artist:|}/g, '').trim();
          } else if (trim.startsWith('{key:') || trim.startsWith('{k:')) {
              extractedKey = trim.replace(/{key:|{k:|}/g, '').trim();
          } else if (trim.startsWith('{capo:')) {
              cleanLines.unshift(`Commentaire: ${trim.replace(/{|}/g, '')}`);
          } else {
              cleanLines.push(line);
          }
      });

      const cleanedBody = sanitizeImportText(cleanLines.join('\n'));

      return {
          title: extractedTitle,
          artist: extractedArtist,
          key: extractedKey,
          content: cleanedBody
      };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      
      const files = Array.from(e.target.files);
      const isMultiple = files.length > 1;
      let importedCount = 0;

      setLoading(true);

      for (const file of files) {
          try {
              const text = await file.text();
              const parsed = parseChordProFile(text);

              if (isMultiple) {
                  await addDoc(collection(db, "songs"), {
                      titre: parsed.title,
                      artiste: parsed.artist || "Inconnu",
                      cle: parsed.key,
                      contenu: parsed.content,
                      categorie: "Import", 
                      mass: "",
                      youtube: "",
                      audio: "",
                      createdAt: new Date()
                  });
                  importedCount++;
              } else {
                  setTitre(parsed.title);
                  setArtiste(parsed.artist);
                  setCle(parsed.key);
                  setContenu(parsed.content);
                  alert(`Fichier "${file.name}" chargé !`);
              }
          } catch (err) {
              console.error(`Erreur lecture fichier ${file.name}:`, err);
          }
      }

      setLoading(false);
      
      if (isMultiple) {
          alert(`${importedCount} chants ont été importés avec succès !`);
          router.push('/');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };


  // --- HANDLER : IMPORT VIA URL ---
  const handleUrlImport = async () => {
      if (!importUrl) return alert("Veuillez coller une URL.");
      setImportingUrl(true);
      
      try {
          const result = await importSongFromUrlAction(importUrl);
          
          if (result) {
              setTitre(result.titre);
              setArtiste(result.artiste);
              const cleanedContent = sanitizeImportText(result.contenu);
              setContenu(cleanedContent);
              alert(`Succès ! Chant importé depuis ${result.source}`);
          } else {
              alert("Impossible d'importer depuis cette URL.");
          }
      } catch (e) { console.error(e); alert("Erreur lors de l'import."); } 
      finally { setImportingUrl(false); }
  };

  // --- SCRIPT : PRESSE-PAPIER INTELLIGENT ---
  const handleSmartClipboard = async () => {
    try {
        const clipboardContent = await navigator.clipboard.readText();
        if (!clipboardContent || clipboardContent.trim() === '') { alert("Presse-papier vide !"); return; }

        const sanitizedContent = sanitizeImportText(clipboardContent);
        const smartChordRegex = /^([A-G][b#♯♭]?)((?:m|M|maj|min|dim|aug|sus|add|°|ø|\+|-|\d|[()])*)(?:\/(?:[A-G][b#♯♭]?|[\d\+\-\(\)b#♯♭]+))?$/;
        const excludedWords = new Set(["A", "a", "I", "Un", "Le", "La", "Les", "De", "Du", "En", "Et", "Est", "Agnus"]);
        const timeSignatureRegex = /^\d{1,2}\/\d{1,2}$/;
        const cleanToken = (t: string) => t.replace(/^[\[\](){}<>.,;*:"']+|[\[\](){}<>.,;*:"']+$/g, '');

        function isLikelyChord(token: string) {
            const clean = cleanToken(token);
            if (!clean) return false;
            if (timeSignatureRegex.test(clean)) return false; 
            if (excludedWords.has(clean)) return false;       
            return smartChordRegex.test(clean);
        }

        function isChordLine(line: string) {
            const cleanLine = line.trim();
            if (!cleanLine) return false;
            if (cleanLine.startsWith('{')) return false;
            const tokens = cleanLine.split(/\s+/);
            let chordCount = 0; let invalidCount = 0;
            tokens.forEach(token => {
                const stripped = cleanToken(token);
                if (!stripped) return; 
                if (/^(intr|intro|final|pont|bridge|coda|couplet|verse|chorus|refrain)[:.]?$/i.test(stripped)) return;
                if (/^[|%/:xX\-_]+$/.test(token)) return; 
                if (isLikelyChord(stripped)) chordCount++; else invalidCount++;
            });
            return chordCount > 0 && chordCount >= invalidCount;
        }

        const lines = sanitizedContent.split('\n');
        let result = [];

        for (let i = 0; i < lines.length; i++) {
            let currentLine = lines[i]; 
            if (currentLine.trim().startsWith('{')) { result.push(currentLine.trim()); continue; }

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
                            if (index >= combinedLine.length) combinedLine = combinedLine.padEnd(index, ' ') + `[${stripped}]`;
                            else combinedLine = combinedLine.slice(0, index) + `[${stripped}]` + combinedLine.slice(index);
                        }
                    }
                    result.push(combinedLine.replace(/ +/g, " ").trim());
                    i++; 
                } else {
                    const processedLine = currentLine.replace(/\S+/g, (token) => {
                         const stripped = cleanToken(token);
                         if (token.startsWith('[') && token.endsWith(']')) return token;
                         if (isLikelyChord(stripped)) return `[${stripped}]`;
                         return token; 
                    });
                    result.push(processedLine.replace(/ +/g, " ").trim());
                }
            } else { result.push(currentLine); }
        }
        const formattedContent = result.join('\n');
        if (contenu && !confirm("Remplacer le contenu existant ?")) setContenu(prev => prev + "\n\n" + formattedContent);
        else setContenu(formattedContent);
        alert("📋 Import réussi !");
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
    } catch (e) { console.error("Erreur autoFill:", e); if(confirm("Erreur recherche. Ouvrir YouTube ?")) searchYoutubeManual(); } finally { setSearchingYt(false); }
  };
  const searchYoutubeManual = () => { if (!titre) return alert("Remplissez d'abord le titre."); window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${artiste} ${titre}`)}`, '_blank'); };

  const applyAutoFix = () => {
    const fixed = cleanupChorusTags(contenu);
    if (fixed !== contenu) { setContenu(fixed); alert("Refrains corrigés ! 🪄"); } else alert("Aucune correction nécessaire.");
  };

  const handleInsert = (text: string, offset = 0) => {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    setContenu(ta.value.substring(0, start) + text + ta.value.substring(ta.selectionEnd));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + text.length - offset, start + text.length - offset); }, 0);
  };

  const handleAudioBlur = () => {
    let url = audio.trim();
    if (url.includes('/s/') && !url.includes('/download')) setAudio((url.endsWith('/') ? url.slice(0, -1) : url) + '/download');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre || !contenu) return alert("Titre et contenu obligatoires");
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "songs"), { titre, artiste: artiste || "Inconnu", cle, contenu, categorie: categorie || "Divers", mass, youtube, audio, createdAt: new Date() });
      router.push(`/song/${docRef.id}`);
    } catch (error) { alert("Erreur enregistrement"); } finally { setLoading(false); }
  };

  const yId = getYoutubeId(youtube);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 sticky top-0 z-30 px-4 py-3 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
        <Link href="/" className="text-gray-500 dark:text-gray-400 font-bold text-sm">Annuler</Link>
        <h1 className="font-bold text-slate-800 dark:text-white">Nouveau Chant</h1>
        <button onClick={handleSubmit} disabled={loading} className="text-orange-600 dark:text-orange-400 font-bold text-sm disabled:opacity-50">
            {loading ? '...' : 'Enregistrer'}
        </button>
      </header>

      <div className="p-4 pb-0 max-w-lg mx-auto space-y-4">
          
          {/* ZONE D'IMPORT UNIFIÉE */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 space-y-3">
             <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Sources d'importation</h3>
             
             {/* OPTION 1 : URL */}
             <div className="flex gap-2">
                 <input 
                    type="text" 
                    placeholder="Coller l'URL (Ultimate Guitar, Cifras Club...)" 
                    className="flex-1 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none" 
                    value={importUrl} 
                    onChange={(e) => setImportUrl(e.target.value)} 
                 />
                 <button 
                    onClick={handleUrlImport} 
                    disabled={importingUrl} 
                    className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg font-bold text-xs hover:bg-blue-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                 >
                    {importingUrl ? '...' : (<><IconDownload /> <span>Importer</span></>)}
                 </button>
             </div>

             <div className="border-t border-gray-100 dark:border-slate-800 my-2"></div>

             {/* OPTION 2 : FICHIER (2ème Option comme demandé) */}
             <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept=".pro,.chopro,.chordpro,.txt,.cho" className="hidden" />
             <button 
                  type="button" 
                  onClick={triggerFileUpload} 
                  className="w-full py-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold text-center rounded-xl shadow-sm hover:bg-indigo-100 transition-all text-sm flex items-center justify-center gap-2"
              >
                  <IconUpload />
                  <span>Importer un fichier ChordPro</span>
              </button>

             {/* OPTION 3 : PRESSE-PAPIER */}
             <button 
                type="button" 
                onClick={handleSmartClipboard} 
                className="w-full py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-gray-300 font-bold text-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-all text-xs flex items-center justify-center gap-2"
             >
                  <IconClipboard />
                  <span>Coller depuis le presse-papier</span>
              </button>
          </div>
          
          <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-slate-800"></div></div>
              <span className="relative px-2 bg-gray-50 dark:bg-slate-950 text-xs text-gray-400 uppercase">Ou saisie manuelle</span>
          </div>
      </div>

      <ChordToolbar content={contenu} onInsert={handleInsert} />

      <div className="p-4 space-y-4 max-w-lg mx-auto pt-0">
        {/* FORMULAIRE DE SAISIE */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
            <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Titre</label><input type="text" className="w-full text-lg font-bold border-b border-gray-200 dark:border-slate-700 pb-2 focus:border-orange-500 outline-none text-slate-800 dark:text-white bg-transparent" value={titre} onChange={e => setTitre(e.target.value)} /></div>
            <div><label className="block text-xs font-bold text-orange-600 dark:text-orange-400 mb-1 uppercase flex justify-between"><span>Ordinaire / Collection</span><span className="text-[9px] opacity-70 font-normal normal-case">Ex: Messe de la Grâce</span></label><input type="text" list="masses-suggestions" className="w-full text-sm font-bold border-b border-orange-200 dark:border-orange-900/50 pb-2 outline-none text-slate-800 dark:text-white bg-transparent placeholder:text-gray-300 dark:placeholder:text-slate-700" placeholder="Sélectionnez ou tapez..." value={mass} onChange={e => setMass(e.target.value)} /><datalist id="masses-suggestions">{existingMasses.map(m => <option key={m} value={m} />)}</datalist></div>
            <div className="flex gap-3">
                <div className="flex-1"><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Artiste</label><input type="text" list="artists-suggestions" placeholder="Ex: Hillsong" className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 focus:border-orange-500 outline-none text-slate-800 dark:text-white bg-transparent" value={artiste} onChange={e => setArtiste(e.target.value)} /><datalist id="artists-suggestions">{existingArtists.map(a => <option key={a} value={a} />)}</datalist></div>
                <div className="w-24"><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Clé</label><select className="w-full text-sm font-bold border-b border-gray-200 dark:border-slate-700 pb-2 bg-transparent text-slate-800 dark:text-white outline-none" value={cle} onChange={e => setCle(e.target.value)}>{["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"].map(k => <option key={k} value={k} className="dark:bg-slate-800">{k}</option>)}</select></div>
            </div>
             <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Catégorie</label><input type="text" list="categories-suggestions" placeholder="Ex: Louange, Adoration..." className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 focus:border-orange-500 outline-none text-slate-800 dark:text-white bg-transparent" value={categorie} onChange={e => setCategorie(e.target.value)} /><datalist id="categories-suggestions">{existingCategories.map(c => <option key={c} value={c} />)}</datalist></div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase flex items-center gap-2"><span>🎵 Liens Multimédia</span></h3>
            <div><label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Lien YouTube</label><div className="flex gap-2"><input type="text" placeholder="https://youtube.com/..." className="flex-1 text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600" value={youtube} onChange={e => setYoutube(e.target.value)} /><button type="button" onClick={autoFillYoutube} disabled={searchingYt} className="bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 text-orange-600 dark:text-orange-400 p-2 rounded-lg transition-colors flex items-center justify-center min-w-[36px]">{searchingYt ? <div className="w-4 h-4 border-2 border-orange-600/30 border-t-orange-600 rounded-full animate-spin"></div> : <IconMagic />}</button><button type="button" onClick={searchYoutubeManual} className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-600 dark:text-gray-400 p-2 rounded-lg transition-colors" title="Ouvrir YouTube">🔍</button></div></div>
            {yId && (<div className="relative w-full rounded-lg overflow-hidden bg-black aspect-video shadow-md border border-gray-200 dark:border-slate-700"><iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${yId}?rel=0&playsinline=1`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe></div>)}
            <div><label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Lien Audio (MP3/Nextcloud)</label><input type="text" placeholder="https://..." className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600" value={audio} onChange={e => setAudio(e.target.value)} onBlur={handleAudioBlur} /></div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col h-[60vh]">
            <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Paroles et Accords</label>
                <button onClick={applyAutoFix} className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-lg font-bold hover:bg-orange-200 transition-colors">🪄 Corriger *</button>
            </div>
            <textarea ref={textareaRef} className="flex-1 w-full font-mono text-sm leading-relaxed p-2 bg-gray-50 dark:bg-slate-950 rounded-lg border border-transparent outline-none resize-none text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/20" placeholder="[G]Dieu est [C]bon..." value={contenu} onChange={e => setContenu(e.target.value)}></textarea>
        </div>
      </div>
    </main>
  );
}