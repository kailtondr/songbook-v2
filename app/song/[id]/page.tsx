'use client';

import { useEffect, useState, use, useMemo, useRef } from 'react';
import { doc, getDoc, collection, query, orderBy, getDocs, updateDoc, arrayUnion, arrayRemove, addDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/authContext';
import { parseChordPro, transposeChord, guessPreferFlats, ChordLine, ChordToken } from '@/lib/musicEngine';
import { useWakeLock } from '@/hooks/useWakeLock';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// --- Icônes ---
const IconBack = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>;
const IconEdit = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
const IconPlaylistAdd = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconHeart = ({ filled }: { filled: boolean }) => (
  <svg className={`w-6 h-6 transition-colors ${filled ? 'fill-red-500 text-red-500' : 'fill-none text-gray-400 dark:text-gray-500'}`} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
);
const IconPlay = () => <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;
const IconPause = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;
const IconPlus = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>;
const IconMinus = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/></svg>;
const IconPalette = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>;
const IconFullscreen = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>;
const IconYoutube = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>;

interface SongData {
    id: string;
    titre: string;
    artiste: string;
    contenu: string;
    cle: string;
    categorie: string;
    mass?: string;
    youtube?: string;
    audio?: string;
}

// Interface pour la navigation
interface NavSong {
    id: string;
    titre: string;
}

const FONTS = { helvetica: "font-sans", georgia: "font-serif", courier: "font-mono" };
const CHORD_COLORS = { red: "text-red-600 dark:text-red-400", orange: "text-orange-600 dark:text-orange-400", blue: "text-blue-600 dark:text-blue-400", black: "text-black dark:text-white" };
type ChordColorKey = keyof typeof CHORD_COLORS;

export default function SongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter(); 
  const searchParams = useSearchParams();
  const playlistId = searchParams.get('playlistId'); 
  useWakeLock();

  const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING');
  const [errorMessage, setErrorMessage] = useState('');
  const [song, setSong] = useState<SongData | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Navigation & Contexte
  const [nav, setNav] = useState<{ prev: NavSong | null; next: NavSong | null }>({ prev: null, next: null });
  const [navContext, setNavContext] = useState<{ title: string; subtitle: string } | null>(null); // NOUVEAU

  // Affichage
  const [semitones, setSemitones] = useState(0);
  const [showChords, setShowChords] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [preferFlat, setPreferFlat] = useState(false);
  const [selectedFont, setSelectedFont] = useState<keyof typeof FONTS>('helvetica');
  const [chordColor, setChordColor] = useState<ChordColorKey>('red');
  
  // YouTube Toggle
  const [showVideo, setShowVideo] = useState(false);

  // UI States
  const [showModal, setShowModal] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(40); 
  const displaySpeed = Math.round((250 - scrollSpeed) / 2.45);
  
  const [isFullScreen, setIsFullScreen] = useState(false);
  const lastTap = useRef<number>(0);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };
  const getCleanAudioUrl = (url: string) => {
    if(!url) return "";
    if (url.includes('/s/') && !url.includes('/download')) return url.endsWith('/') ? url + 'download' : url + '/download';
    return url;
  };

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
              categorie: data.categorie || "",
              mass: data.mass || "",
              youtube: data.youtube,
              audio: data.audio
          });
          if (data.cle && guessPreferFlats(data.cle)) setPreferFlat(true);
          setStatus('SUCCESS');
        } else {
          setErrorMessage("Chant introuvable");
          setStatus('ERROR');
        }
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const favorites = userDoc.data().favorites || [];
                setIsFavorite(favorites.includes(id));
            }
        }
      } catch (err: any) {
        setErrorMessage(err.message);
        setStatus('ERROR');
      }
    };
    loadData();
  }, [id, user]);

  // CHARGEMENT DE LA NAVIGATION & CONTEXTE
  useEffect(() => {
    if(status === 'SUCCESS' && song) {
        const fetchNeighbors = async () => {
            try {
                let allDocs = [];

                if (playlistId) {
                    // CAS 1: NAVIGATION PLAYLIST
                    const plDoc = await getDoc(doc(db, 'playlists', playlistId));
                    if (plDoc.exists()) {
                        const plData = plDoc.data();
                        const songIds: string[] = plData.songs || [];
                        
                        // Définir le contexte (Titre + Date)
                        const dateFormatted = plData.date ? new Date(plData.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
                        setNavContext({ title: plData.name, subtitle: dateFormatted });

                        // Récupérer les voisins
                        const promises = songIds.map(async (sid) => {
                            const d = await getDoc(doc(db, 'songs', sid));
                            return d.exists() ? { id: d.id, titre: d.data().titre } : null;
                        });
                        const results = await Promise.all(promises);
                        allDocs = results.filter(r => r !== null) as NavSong[];
                    }
                } else {
                    // CAS 2: NAVIGATION GLOBALE
                    setNavContext({ title: "Chantez le Seigneur", subtitle: "" }); // Contexte par défaut
                    
                    const q = query(collection(db, "songs"), orderBy("titre"));
                    const snap = await getDocs(q);
                    allDocs = snap.docs.map(d => ({ id: d.id, titre: d.data().titre }));
                }
                
                const currentIndex = allDocs.findIndex(d => d.id === id);
                if (currentIndex !== -1) {
                    setNav({
                        prev: currentIndex > 0 ? allDocs[currentIndex - 1] : null,
                        next: currentIndex < allDocs.length - 1 ? allDocs[currentIndex + 1] : null
                    });
                }
            } catch (e) { console.error("Err nav", e); }
        };
        fetchNeighbors();
    }
  }, [status, song, id, playlistId]);

  const goToArtist = () => { if(song?.artiste) router.push(`/artist/${encodeURIComponent(song.artiste)}`); };
  
  const toggleFavorite = async () => {
    if (!user) return alert("Connectez-vous pour ajouter aux favoris.");
    const newState = !isFavorite;
    setIsFavorite(newState);
    try {
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, { email: user.email }, { merge: true });
        await updateDoc(userRef, { favorites: newState ? arrayUnion(id) : arrayRemove(id) });
    } catch (e) {
        setIsFavorite(!newState);
        alert("Erreur réseau");
    }
  };

  const toggleChordColor = () => {
      const colors: ChordColorKey[] = ['red', 'orange', 'blue', 'black'];
      const currentIndex = colors.indexOf(chordColor);
      const nextIndex = (currentIndex + 1) % colors.length;
      setChordColor(colors[nextIndex]);
  };

  useEffect(() => {
    if (isFullScreen) document.body.classList.add('fullscreen');
    else document.body.classList.remove('fullscreen');
    return () => document.body.classList.remove('fullscreen');
  }, [isFullScreen]);

  const handleDoubleTap = () => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      if (now - lastTap.current < DOUBLE_TAP_DELAY) {
          setIsFullScreen(!isFullScreen);
      }
      lastTap.current = now;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const savedFont = localStorage.getItem('sb_font') as keyof typeof FONTS;
        const savedColor = localStorage.getItem('sb_chordColor') as ChordColorKey;
        if (savedFont && FONTS[savedFont]) setSelectedFont(savedFont);
        if (savedColor && CHORD_COLORS[savedColor]) setChordColor(savedColor);
    }
  }, []);

  useEffect(() => { localStorage.setItem('sb_font', selectedFont); }, [selectedFont]);
  useEffect(() => { localStorage.setItem('sb_chordColor', chordColor); }, [chordColor]);

  useEffect(() => {
    let scrollInterval: NodeJS.Timeout;
    if (isScrolling) {
      scrollInterval = setInterval(() => {
        window.scrollBy(0, 1);
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) setIsScrolling(false);
      }, scrollSpeed);
    }
    return () => clearInterval(scrollInterval);
  }, [isScrolling, scrollSpeed]);

  const toggleScroll = () => setIsScrolling(!isScrolling);
  const changeSpeed = (delta: number) => {
    setScrollSpeed(prev => { const next = prev - (delta * 2); return Math.max(5, Math.min(250, next)); });
  };

  const openPlaylistModal = async () => {
    setShowModal(true); setIsCreating(false); setNewPlaylistName('');
    if (playlists.length > 0) return;
    setLoadingPlaylists(true);
    try {
      const q = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); } finally { setLoadingPlaylists(false); }
  };
  const addToPlaylist = async (playlistId: string, playlistName: string) => {
    try { await updateDoc(doc(db, "playlists", playlistId), { songs: arrayUnion(id) }); alert(`Ajouté à "${playlistName}" ! ✅`); setShowModal(false); } catch (e) { alert("Erreur ajout"); }
  };
  const createAndAdd = async (e: React.FormEvent) => {
    e.preventDefault(); if(!newPlaylistName.trim()) return;
    try { await addDoc(collection(db, "playlists"), { name: newPlaylistName, createdAt: new Date(), songs: [id] }); alert(`Playlist créée ! 🎉`); setShowModal(false); setPlaylists([]); } catch (error) { alert("Erreur création"); }
  };

  // --- RENDU ---
  const structuredContent = useMemo(() => {
    if (!song?.contenu) return [];
    
    const flatLines = parseChordPro(song.contenu);
    const sections: { type: 'normal' | 'chorus'; lines: any[][] }[] = [];
    let currentSection: { type: 'normal' | 'chorus'; lines: any[][] } = { type: 'normal', lines: [] };

    const groupLineTokens = (line: ChordLine) => {
        const groups: { chord?: ChordToken, lyrics?: ChordToken, token?: ChordToken }[] = [];
        let i = 0;
        while (i < line.length) {
            const token = line[i];
            if (token.type === 'chord') {
                const next = line[i + 1];
                if (next && next.type === 'lyrics') {
                    groups.push({ chord: token, lyrics: next });
                    i += 2;
                } else {
                    groups.push({ chord: token });
                    i++;
                }
            } else if (token.type === 'lyrics') {
                groups.push({ lyrics: token });
                i++;
            } else {
                groups.push({ token: token });
                i++;
            }
        }
        return groups;
    };

    flatLines.forEach(line => {
        const firstToken = line[0];
        if (firstToken?.type === 'chorus_start') {
            if (currentSection.lines.length > 0) sections.push(currentSection);
            currentSection = { type: 'chorus', lines: [] };
        } else if (firstToken?.type === 'chorus_end') {
            if (currentSection.lines.length > 0) sections.push(currentSection);
            currentSection = { type: 'normal', lines: [] };
        } else {
            currentSection.lines.push(groupLineTokens(line));
        }
    });
    if (currentSection.lines.length > 0) sections.push(currentSection);
    return sections;
  }, [song]);

  let contentDisplay = null;
  if (status === 'SUCCESS' && song) {
    try {
      contentDisplay = structuredContent.map((section, secIdx) => (
        <div 
            key={secIdx} 
            className={`mb-2 ${section.type === 'chorus' ? 'pl-4 border-l-4 border-orange-500 bg-orange-50/50 dark:bg-orange-900/10 rounded-r-xl py-2 shadow-sm my-3' : ''}`}
        >
            {section.type === 'chorus' && <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest mb-1 opacity-70">Refrain</div>}

            {section.lines.map((line, i) => (
                <div key={i} className={`flex flex-wrap items-end ${FONTS[selectedFont]} leading-relaxed transition-all ${!showChords ? 'mb-1' : 'mb-3'}`}>
                    {line.map((group, j) => {
                        if (group.token) {
                            if (group.token.type === 'header') return <div key={j} className="w-full mt-2 mb-1 font-sans font-bold text-orange-600 dark:text-orange-400 print:text-black uppercase tracking-wider border-b border-orange-100 dark:border-orange-900/30 print:border-gray-300 pb-1 text-[0.9em]">{group.token.value}</div>;
                            if (group.token.type === 'comment') return <div key={j} className="w-full text-gray-500 dark:text-gray-400 print:text-gray-600 italic mb-1 text-sm bg-gray-100 dark:bg-slate-800 print:bg-transparent p-1 rounded">{group.token.value}</div>;
                            if (group.token.type === 'space') return <div key={j} className="w-full h-2"></div>;
                            return null;
                        }

                        const chordVal = group.chord ? (showChords ? transposeChord(group.chord.originalChord!, semitones, preferFlat) : null) : null;
                        const lyricsVal = group.lyrics ? group.lyrics.value : "\u00A0";
                        const spacerClass = group.chord?.isSpacer ? "pr-4" : "pr-0";

                        return (
                            <div key={j} className={`flex flex-col items-start min-w-[1ch] ${spacerClass}`}>
                                {showChords && (
                                    <span className={`text-[0.95em] font-bold mb-0.5 select-none leading-none h-[1.2em] whitespace-nowrap transition-opacity ${chordVal ? `${CHORD_COLORS[chordColor]} print:text-black` : 'opacity-0'}`}>
                                        {chordVal || "."}
                                    </span>
                                )}
                                <span className={`text-slate-800 dark:text-slate-200 print:text-black whitespace-pre ${section.type === 'chorus' ? 'font-black text-slate-900 dark:text-white' : ''}`}>
                                    {lyricsVal}
                                </span>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
      ));
    } catch (renderError) { contentDisplay = <div>Erreur d'affichage</div>; }
  }

  if (status === 'LOADING') return <div className="flex h-screen items-center justify-center text-gray-500 dark:text-gray-400">Chargement...</div>;
  if (status === 'ERROR') return <div className="p-8 text-center text-red-600 dark:text-red-400">{errorMessage} <br/><Link href="/" className="underline">Retour</Link></div>;

  const yId = song?.youtube ? getYoutubeId(song.youtube) : null;

  return (
    <div 
        className="min-h-screen bg-white dark:bg-slate-950 print:bg-white pb-40 text-slate-800 dark:text-slate-200 relative transition-colors duration-300"
        onClick={handleDoubleTap} 
    >
      
      {/* HEADER */}
      <header 
        className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-gray-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3 shadow-sm transition-transform duration-300 print:hidden" 
        style={{ transform: (isScrolling || isFullScreen) ? 'translateY(-100%)' : 'translateY(0)' }}
      >
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300"><IconBack /></Link>
        <div className="flex-1 overflow-hidden">
          <h1 className="text-lg font-bold truncate text-slate-900 dark:text-white uppercase">{song?.titre}</h1>
          <button onClick={goToArtist} className="text-xs text-orange-600 dark:text-orange-400 truncate font-medium hover:underline text-left block w-full">{song?.artiste}</button>
          {song?.mass && (
            <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wide truncate">{song.mass}</p>
          )}
        </div>
        <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300" title="Plein Écran"><IconFullscreen /></button>
        <button onClick={toggleFavorite} className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-slate-800 transition-colors"><IconHeart filled={isFavorite} /></button>
        <button onClick={openPlaylistModal} className="p-2 rounded-full hover:bg-orange-50 dark:hover:bg-slate-800 text-gray-400 dark:text-gray-500 hover:text-orange-600 dark:hover:text-orange-400"><IconPlaylistAdd /></button>
        <Link href={`/edit/${id}`} className="p-2 rounded-full hover:bg-orange-50 dark:hover:bg-slate-800 text-gray-400 dark:text-gray-500 hover:text-orange-600 dark:hover:text-orange-400"><IconEdit /></Link>
      </header>

      {/* CONTROLS */}
      <div className={`bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-[61px] z-10 overflow-x-auto no-scrollbar py-2 px-4 flex gap-3 transition-transform duration-300 print:hidden ${(isScrolling || isFullScreen) ? '-translate-y-[200%]' : 'translate-y-0'}`}>
         
         <div className="flex bg-white dark:bg-slate-800 rounded border border-gray-300 dark:border-slate-700 shadow-sm h-9 items-center">
            <button onClick={() => setSemitones(s => s - 1)} className="px-3 h-full border-r border-gray-300 dark:border-slate-700 font-bold hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">-</button>
            <button onClick={() => setSemitones(0)} className="px-2 h-full text-xs font-mono text-gray-500 dark:text-gray-400">Key</button>
            <button onClick={() => setSemitones(s => s + 1)} className="px-3 h-full border-l border-gray-300 dark:border-slate-700 font-bold hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">+</button>
         </div>
         
         <button onClick={() => setShowChords(!showChords)} className={`px-3 h-9 rounded border shadow-sm text-sm font-bold transition-colors ${showChords ? 'bg-orange-600 text-white border-orange-700' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-700'}`}>
            {showChords ? 'ON' : 'OFF'}
         </button>

         <button onClick={toggleChordColor} className={`px-3 h-9 rounded border shadow-sm text-sm font-bold transition-colors flex items-center justify-center bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300`}>
            <div className={`w-3 h-3 rounded-full mr-1 ${chordColor === 'red' ? 'bg-red-500' : chordColor === 'orange' ? 'bg-orange-500' : chordColor === 'blue' ? 'bg-blue-500' : 'bg-black dark:bg-white'}`}></div>
            <IconPalette />
         </button>

         {yId && (
            <button 
                onClick={() => setShowVideo(!showVideo)} 
                className={`px-3 h-9 rounded border shadow-sm transition-colors flex items-center justify-center ${showVideo ? 'bg-red-600 text-white border-red-700' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-red-600'}`}
                title="Afficher/Masquer la vidéo"
            >
                <IconYoutube />
            </button>
         )}
         
         <div className="flex bg-white dark:bg-slate-800 rounded border border-gray-300 dark:border-slate-700 shadow-sm h-9 items-center ml-auto">
            <select className="h-full px-2 text-[10px] font-bold bg-transparent text-slate-600 dark:text-slate-300 border-r border-gray-300 dark:border-slate-700 outline-none uppercase" value={selectedFont} onChange={(e) => setSelectedFont(e.target.value as keyof typeof FONTS)}>
                <option value="helvetica">Helv.</option><option value="georgia">Geor.</option><option value="courier">Cour.</option>
            </select>
            <button onClick={() => setFontSize(s => Math.max(12, s - 2))} className="px-3 h-full border-r border-gray-300 dark:border-slate-700 font-bold hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">A-</button>
            <button onClick={() => setFontSize(s => Math.min(32, s + 2))} className="px-3 h-full font-bold hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">A+</button>
         </div>
      </div>

      <div className="hidden print:block text-center mb-8 pt-4 border-b pb-4">
          <h1 className="text-3xl font-bold text-black uppercase">{song?.titre}</h1>
          <p className="text-lg text-gray-600">{song?.artiste} — Clé: {transposeChord(song?.cle || 'C', semitones, preferFlat)}</p>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-0 lg:p-6">
        
        {showVideo && yId && (
            <div className="relative w-full max-w-2xl mx-auto mb-6 bg-black rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4 border-2 border-slate-900/10 dark:border-slate-700">
                <button 
                    onClick={() => setShowVideo(false)} 
                    className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-all"
                    title="Fermer la vidéo"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <div className="relative pb-[56.25%] h-0">
                    <iframe 
                        className="absolute top-0 left-0 w-full h-full" 
                        src={`https://www.youtube-nocookie.com/embed/${yId}?rel=0&playsinline=1&autoplay=1`} 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                    ></iframe>
                </div>
            </div>
        )}

        {song?.audio && !showVideo && (
             <div className="mb-4 bg-gray-50 dark:bg-slate-900 rounded-lg p-2 border border-gray-200 dark:border-slate-800">
                <audio controls className="w-full h-8 block" src={getCleanAudioUrl(song.audio)}>Votre navigateur ne supporte pas l'audio.</audio>
             </div>
        )}
        
        <main className="w-full" style={{ fontSize: `${fontSize}px` }}>
            {contentDisplay}
            
            {/* --- NAVIGATION FOOTER --- */}
            <div className="mt-16 pt-8 border-t border-gray-100 dark:border-slate-800 pb-8 flex flex-col gap-6 print:hidden">
                
                {/* CONTEXTE NAVIGATION */}
                {navContext && (
                    <div className="text-center">
                        <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{navContext.title}</h3>
                        {navContext.subtitle && <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">{navContext.subtitle}</p>}
                    </div>
                )}

                {/* BOUTONS NAV */}
                <div className="flex justify-between items-center gap-4">
                    {nav.prev ? (
                        <Link href={`/song/${nav.prev.id}${playlistId ? `?playlistId=${playlistId}` : ''}`} className="flex-1 max-w-[45%] group flex flex-col items-start text-left bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-orange-200 dark:hover:border-slate-700 transition-all">
                             <div className="flex items-center gap-2 text-gray-400 group-hover:text-orange-600 text-xs font-bold uppercase mb-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                                Précédent
                             </div>
                             <span className="text-sm font-bold text-slate-800 dark:text-white truncate w-full uppercase">{nav.prev.titre}</span>
                        </Link>
                    ) : <div className="flex-1"></div>}

                    {nav.next ? (
                        <Link href={`/song/${nav.next.id}${playlistId ? `?playlistId=${playlistId}` : ''}`} className="flex-1 max-w-[45%] group flex flex-col items-end text-right bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-orange-200 dark:hover:border-slate-700 transition-all">
                             <div className="flex items-center gap-2 text-gray-400 group-hover:text-orange-600 text-xs font-bold uppercase mb-1">
                                Suivant
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                             </div>
                             <span className="text-sm font-bold text-slate-800 dark:text-white truncate w-full uppercase">{nav.next.titre}</span>
                        </Link>
                    ) : <div className="flex-1"></div>}
                </div>

                <div className="text-center mt-2">
                    <p className="text-gray-400 dark:text-gray-500 text-sm italic">© {song?.artiste}</p>
                </div>
            </div>

        </main>
      </div>

      <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3 print:hidden">
         {isScrolling && (
             <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-gray-200 dark:border-slate-700 rounded-full p-1.5 shadow-lg flex flex-col gap-2 mb-2 animate-in slide-in-from-bottom-5">
                 <button onClick={() => changeSpeed(1)} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 flex items-center justify-center active:bg-gray-300 transition-colors"><IconPlus /></button>
                 <span className="text-center text-xs font-bold text-orange-600 dark:text-orange-400 font-mono py-1">{displaySpeed}</span>
                 <button onClick={() => changeSpeed(-1)} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 flex items-center justify-center active:bg-gray-300 transition-colors"><IconMinus /></button>
             </div>
         )}
         <button onClick={toggleScroll} className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all active:scale-95 ${isScrolling ? 'bg-red-500 text-white animate-pulse' : 'bg-orange-600 text-white hover:bg-orange-700'}`}>{isScrolling ? ( <IconPause /> ) : ( <IconPlay /> )}</button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:hidden">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[80vh] border dark:border-slate-800">
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800 flex-shrink-0">
                    <h3 className="font-bold text-slate-800 dark:text-white">Ajouter à une liste</h3>
                    <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">✕</button>
                </div>
                <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-orange-50/50 dark:bg-orange-900/10 flex-shrink-0">
                    {!isCreating ? (
                        <button onClick={() => setIsCreating(true)} className="w-full py-2 border-2 border-dashed border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 font-bold rounded-xl text-sm">+ Nouvelle Playlist</button>
                    ) : (
                        <form onSubmit={createAndAdd} className="flex gap-2">
                            <input autoFocus type="text" placeholder="Nom..." className="flex-1 px-3 py-2 rounded-lg border border-orange-200 dark:border-orange-800 dark:bg-slate-800 dark:text-white text-sm text-slate-800" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} />
                            <button type="submit" className="bg-orange-600 text-white px-3 py-2 rounded-lg font-bold text-xs">OK</button>
                            <button type="button" onClick={() => setIsCreating(false)} className="text-gray-400 px-2">×</button>
                        </form>
                    )}
                </div>
                <div className="overflow-y-auto p-2 flex-1">
                    {playlists.map(pl => (
                        <button key={pl.id} onClick={() => addToPlaylist(pl.id, pl.name)} className="w-full text-left p-3 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-xl flex items-center justify-between group border-b border-gray-50 dark:border-slate-800 last:border-0">
                            <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-orange-700 dark:group-hover:text-orange-400">{pl.name}</span>
                            <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full">{pl.songs?.length || 0}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}