'use client';

import { useEffect, useState, use } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

// Structure liturgique
const MESSE_STRUCTURE = [
  "Entrée", "Acte pénitentiel", "Kyrie", "Gloria", "Psaume", "Acclamation", "Credo", "PU", 
  "Offertoire", "Sanctus", "Anamnèse", "Amen", "Agnus Dei", 
  "Communion", "Action de grâces", "Envoi"
];

// Mots-clés pour deviner où va le chant
const SLOT_KEYWORDS: Record<string, string[]> = {
  "Kyrie": ["kyrie"],
  "Gloria": ["gloria", "gloire"],
  "Psaume": ["psaume"],
  "Acclamation": ["alléluia", "alleluia", "acclamation"],
  "Credo": ["credo", "je crois"],
  "Sanctus": ["sanctus", "saint le seigneur"],
  "Anamnèse": ["anamnèse", "anamnese"],
  "Agnus Dei": ["agnus", "agneau"],
  "Entrée": ["entrée", "entree"],
  "Offertoire": ["offertoire"],
  "Communion": ["communion"],
  "Envoi": ["envoi", "sortie"],
};

export default function PlaylistDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  // Données
  const [playlist, setPlaylist] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]); 
  const [teams, setTeams] = useState<any[]>([]);
  const [musicians, setMusicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États UI
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLink, setEditLink] = useState(''); 
  const [editResponsable, setEditResponsable] = useState('');
  const [printChords, setPrintChords] = useState(true);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Recherche & Import
  const [showSearch, setShowSearch] = useState(false);
  const [targetSlot, setTargetSlot] = useState<string | null>(null);
  const [allSongsIndex, setAllSongsIndex] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // NOUVEAU : Gestion des Ordinaires
  const [availableOrdinaries, setAvailableOrdinaries] = useState<string[]>([]);
  const [selectedOrdinary, setSelectedOrdinary] = useState('');

  // 1. Chargement
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      const plDoc = await getDoc(doc(db, "playlists", id));
      if (!plDoc.exists()) return;
      const plData = plDoc.data();
      setPlaylist({ id: plDoc.id, ...plData });
      
      setEditName(plData.name || '');
      setEditDate(plData.date || '');
      setEditLink(plData.externalLink || ''); 
      setEditResponsable(plData.responsable || '');

      if (plData.songs && plData.songs.length > 0) {
        const songsData = await Promise.all(
          plData.songs.map(async (songId: string) => {
            const songDoc = await getDoc(doc(db, "songs", songId));
            if (songDoc.exists()) return { id: songDoc.id, ...songDoc.data() };
            return null;
          })
        );
        setSongs(songsData.filter(s => s !== null));
      }

      const teamsSnap = await getDocs(collection(db, "teams"));
      setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const musiciansSnap = await getDocs(collection(db, "musicians"));
      setMusicians(musiciansSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchData();
  }, [id]);

  // 2. Index & Détection des Ordinaires
  useEffect(() => {
    const loadIndex = async () => {
        const q = query(collection(db, "songs"), orderBy("titre"));
        const snapshot = await getDocs(q);
        const index = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllSongsIndex(index);

        // Extraire les noms de messes (Ordinaires) uniques
        // On suppose que vos chants ont un champ 'mass' ou 'collection'
        // Si vous n'avez pas encore ce champ, il faudra l'ajouter à vos chants
        const masses = new Set<string>();
        index.forEach((s: any) => {
            if (s.mass) masses.add(s.mass); // Champ 'mass' dans le chant
        });
        setAvailableOrdinaries(Array.from(masses).sort());
    };
    if(allSongsIndex.length === 0) loadIndex();
  }, [allSongsIndex.length]);

  // --- LOGIQUE D'IMPORTATION ORDINAIRE ---
  const handleImportOrdinary = async (massName: string) => {
      if (!massName || !playlist) return;
      if (!confirm(`Remplir les cases vides avec "${massName}" ?`)) return;

      // 1. Trouver tous les chants de cette messe
      const ordinarySongs = allSongsIndex.filter(s => s.mass === massName);
      
      let newSlots = { ...(playlist.slots || {}) };
      let newSongsIds = [...(playlist.songs || [])];
      let songsToAddDetails: any[] = [];

      // 2. Pour chaque chant de l'ordinaire, essayer de trouver sa place
      ordinarySongs.forEach(song => {
          // On cherche où le mettre en regardant son titre ou sa catégorie
          const lowerTitle = song.titre.toLowerCase();
          const lowerCat = (song.categorie || "").toLowerCase();

          // On parcourt la structure de la messe
          for (const slot of MESSE_STRUCTURE) {
              const keywords = SLOT_KEYWORDS[slot] || [slot.toLowerCase()];
              // Si le titre ou la catégorie contient un mot clé (ex: "kyrie")
              const match = keywords.some(k => lowerTitle.includes(k) || lowerCat.includes(k));
              
              if (match) {
                  // On vérifie si le slot est vide ou si on veut ajouter
                  const currentSlotContent = newSlots[slot] || [];
                  if (!currentSlotContent.includes(song.id)) {
                      newSlots[slot] = [...currentSlotContent, song.id];
                      
                      // Ajouter à la liste globale si pas présent
                      if (!newSongsIds.includes(song.id)) {
                          newSongsIds.push(song.id);
                          songsToAddDetails.push(song);
                      }
                  }
                  break; // Chant placé, on passe au suivant
              }
          }
      });

      // 3. Sauvegarde
      await updateDoc(doc(db, "playlists", id), { songs: newSongsIds, slots: newSlots });
      setPlaylist((prev: any) => ({ ...prev, songs: newSongsIds, slots: newSlots }));
      setSongs((prev: any[]) => [...prev, ...songsToAddDetails]);
      setSelectedOrdinary(''); // Reset select
  };

  // Actions
  const addSongToPlaylist = async (song: any) => {
    if (!playlist) return;
    const newSongsIds = [...(playlist.songs || [])];
    if (!newSongsIds.includes(song.id)) newSongsIds.push(song.id);
    let newSlots = { ...(playlist.slots || {}) };
    if (playlist.type === 'messe' && targetSlot) {
        const currentSlotSongs = newSlots[targetSlot] || [];
        if (!currentSlotSongs.includes(song.id)) newSlots[targetSlot] = [...currentSlotSongs, song.id];
    }
    await updateDoc(doc(db, "playlists", id), { songs: newSongsIds, slots: newSlots });
    setPlaylist((prev: any) => ({ ...prev, songs: newSongsIds, slots: newSlots }));
    if (!songs.find(s => s.id === song.id)) setSongs((prev: any[]) => [...prev, song]);
    setShowSearch(false); setSearchTerm('');
  };

  const removeSong = async (songId: string, slotName?: string) => {
    if(!playlist) return;
    let newSlots = { ...(playlist.slots || {}) };
    let newSongsIds = [...playlist.songs];
    if (slotName && playlist.type === 'messe') {
        newSlots[slotName] = newSlots[slotName].filter((id: string) => id !== songId);
    } else {
        newSongsIds = newSongsIds.filter(id => id !== songId);
        if(playlist.type === 'messe') {
            Object.keys(newSlots).forEach(key => {
                newSlots[key] = newSlots[key].filter((id: string) => id !== songId);
            });
        }
    }
    await updateDoc(doc(db, "playlists", id), { songs: newSongsIds, slots: newSlots });
    setPlaylist({ ...playlist, songs: newSongsIds, slots: newSlots });
    if (!slotName) setSongs(songs.filter(s => s.id !== songId));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!playlist) return;
    const updateData: any = { name: editName, date: editDate, externalLink: editLink };
    if (playlist.type === 'messe') updateData.responsable = editResponsable;
    await updateDoc(doc(db, "playlists", id), updateData);
    setPlaylist({ ...playlist, ...updateData }); setIsEditing(false);
  };

  const handleAssignTeam = async (teamId: string) => {
    if (!playlist) return;
    await updateDoc(doc(db, "playlists", id), { assignedTeamId: teamId });
    setPlaylist({ ...playlist, assignedTeamId: teamId });
  };

  const renderPrintContent = (text: string) => {
    if (!text) return "Pas de paroles.";
    const blocks = text.split(/\{soc\}([\s\S]*?)\{eoc\}/gi);
    return (
        <div>
            {blocks.map((blockContent, index) => {
                if (!blockContent.trim()) return null;
                const isChorus = index % 2 === 1;
                return (
                    <div key={index} className={`mb-4 relative ${isChorus ? 'pl-4 border-l-2 border-black ml-1' : ''}`}>
                        {isChorus && <span className="block text-xs font-bold uppercase text-gray-500 mb-1">Refrain</span>}
                        <div className={`font-sans text-sm whitespace-pre-wrap ${isChorus ? 'font-bold' : ''} ${printChords ? 'leading-[2.6rem]' : 'leading-normal'}`}>
                             {renderBlockWithChords(blockContent)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  const renderBlockWithChords = (text: string) => {
      if (!printChords) return text.replace(/\[.*?\]/g, '');
      const parts = text.split(/(\[.*?\])/g);
      return parts.map((part, i) => {
          if (part.startsWith('[') && part.endsWith(']')) {
              const chordName = part.slice(1, -1);
              return (
                  <span key={i} className="relative inline-block w-0 overflow-visible align-top">
                      <span className="absolute -top-5 left-0 text-red-600 font-bold text-[0.8em] whitespace-nowrap sans-serif">{chordName}</span>
                  </span>
              );
          }
          return <span key={i} className="relative">{part}</span>;
      });
  };

  const handleShare = () => {
    if (!playlist) return;
    const dateStr = playlist.date ? new Date(playlist.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    let text = `📅 *${playlist.name}*\n${dateStr}\n\n🔗 Lien: ${window.location.href}`;
    navigator.clipboard.writeText(text).then(() => alert("📝 Lien copié !")).catch(() => alert("Erreur copie"));
  };

  const triggerPrint = (withChords: boolean) => {
    setPrintChords(withChords);
    setShowPrintModal(false);
    setTimeout(() => { window.print(); }, 300);
  };

  const openSearch = (slot?: string) => { setTargetSlot(slot || null); setShowSearch(true); };
  const formatDate = (dateStr: string) => { if(!dateStr) return ""; return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };

  const getAssignedTeamMembers = () => {
    if (!playlist?.assignedTeamId) return null;
    const team = teams.find(t => t.id === playlist.assignedTeamId);
    if (!team || !team.members) return null;
    return team.members.map((mid: string) => musicians.find(m => m.id === mid)).filter(Boolean);
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Chargement...</div>;
  if (!playlist) return <div className="p-10 text-center dark:text-white">Playlist introuvable</div>;
  
  const isMesse = playlist.type === 'messe';
  const assignedMembers = getAssignedTeamMembers();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      
      <style jsx global>{`
        @media print {
          @page { margin: 1cm; size: auto; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, footer, header, .fixed, .sticky, [class*="fixed"], [class*="sticky"], [class*="bottom-0"], [class*="z-50"] { display: none !important; }
          .print\\:block { display: block !important; position: relative !important; z-index: 9999 !important; }
        }
      `}</style>

      {/* =======================
          VUE ÉCRAN
         ======================= */}
      <div className="print:hidden pb-40">
          
          <header className="bg-white dark:bg-slate-900 sticky top-0 z-10 px-4 py-4 border-b border-gray-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Link href="/playlists" className="p-2 -ml-2 text-gray-500 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </Link>
                <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                        <h1 className="font-bold text-lg text-slate-800 dark:text-white leading-none truncate max-w-[200px]">{playlist.name}</h1>
                    </div>
                    <div className="flex gap-2 text-xs mt-1">
                        {playlist.date && <p className="text-orange-600 dark:text-orange-400 font-medium capitalize">{formatDate(playlist.date)}</p>}
                    </div>
                </div>
            </div>
            
            <div className="flex gap-1 items-center">
                {playlist.externalLink && (
                    <a href={playlist.externalLink} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 dark:bg-blue-900/20" title="Ouvrir le dossier"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg></a>
                )}
                <button onClick={() => setShowPrintModal(true)} className="p-2 text-slate-600 bg-gray-100 rounded-full hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300" title="Imprimer / PDF"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg></button>
                <button onClick={handleShare} className="p-2 text-orange-600 bg-orange-50 rounded-full hover:bg-orange-100 dark:bg-orange-900/20"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></button>
                <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-slate-600 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
            </div>
          </header>

          <div className="p-4 space-y-6">
            
            {/* --- NOUVEAU : SELECTEUR D'ORDINAIRE --- */}
            {isMesse && availableOrdinaries.length > 0 && (
                <div className="bg-orange-50/50 dark:bg-orange-900/10 p-3 rounded-xl border border-orange-100 dark:border-orange-900/30 flex items-center gap-3">
                    <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-full text-orange-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase block mb-1">Remplissage Automatique</label>
                        <select 
                            className="w-full text-sm bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-gray-200"
                            value={selectedOrdinary}
                            onChange={(e) => {
                                setSelectedOrdinary(e.target.value);
                                if(e.target.value) handleImportOrdinary(e.target.value);
                            }}
                        >
                            <option value="">✨ Importer un Ordinaire...</option>
                            {availableOrdinaries.map(ord => <option key={ord} value={ord}>{ord}</option>)}
                        </select>
                    </div>
                </div>
            )}

            {/* --- LISTE MESSE --- */}
            {isMesse ? (
                <div className="space-y-1">
                    {MESSE_STRUCTURE.map((step) => {
                        const stepSongIds = playlist.slots?.[step] || [];
                        const stepSongs = songs.filter(s => stepSongIds.includes(s.id));
                        return (
                            <div key={step} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-2.5 flex items-start sm:items-center gap-3 shadow-sm mb-2 group transition-colors hover:border-orange-200">
                                <div className="flex items-center gap-2 shrink-0 pt-0.5 sm:pt-0">
                                    <h3 className="text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase w-20 sm:w-24 truncate text-right tracking-tight">{step}</h3>
                                    <button onClick={() => openSearch(step)} className="w-6 h-6 flex items-center justify-center rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors font-bold text-sm leading-none pb-0.5">+</button>
                                </div>
                                <div className="w-px self-stretch bg-gray-100 dark:bg-slate-800 mx-1"></div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    {stepSongs.length === 0 ? (
                                        <div onClick={() => openSearch(step)} className="text-[10px] text-gray-300 italic cursor-pointer hover:text-orange-400">Ajouter...</div>
                                    ) : (
                                        <div className="flex flex-col gap-1.5">
                                            {stepSongs.map(song => (
                                                <div key={song.id} className="flex items-center justify-between gap-2">
                                                    <Link href={`/song/${song.id}`} className="truncate flex-1 min-w-0">
                                                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate block hover:text-orange-600 uppercase leading-none mb-0.5">{song.titre}</div>
                                                        <div className="text-[9px] text-gray-400 truncate leading-none">{song.artiste}</div>
                                                    </Link>
                                                    <button onClick={() => removeSong(song.id, step)} className="text-gray-300 hover:text-red-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-2">
                    {songs.length === 0 ? <p className="text-center text-gray-400 py-10">Playlist vide.</p> : 
                        songs.map((song, index) => (
                            <div key={song.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-800 last:border-0 group">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="text-xs font-bold text-gray-300 w-4">{index + 1}</span>
                                    <Link href={`/song/${song.id}`} className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                             <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate uppercase">{song.titre}</span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 truncate">{song.artiste}</div>
                                    </Link>
                                </div>
                                <button onClick={() => removeSong(song.id)} className="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                        ))
                    }
                    <button onClick={() => openSearch()} className="w-full py-3 mt-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-slate-900 text-xs">+ Ajouter un chant</button>
                </div>
            )}
          </div>

          <div className="mx-4 mt-8 mb-4 p-4 bg-orange-50 dark:bg-slate-900/50 rounded-2xl border border-orange-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-orange-800 dark:text-orange-400 uppercase mb-3 flex items-center gap-2"><span>🎸</span> Animation & Équipe</h3>
              <select className="w-full p-2 bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-gray-200 outline-none mb-3" value={playlist.assignedTeamId || ''} onChange={(e) => handleAssignTeam(e.target.value)}>
                <option value="">-- Choisir une équipe --</option>
                {teams.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
              </select>
              {assignedMembers && assignedMembers.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                    {assignedMembers.map((m: any) => (
                        <div key={m.id} className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-orange-100 dark:border-slate-800 flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0 ${m.role === 'Chanteur' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                {m.imageUrl ? <img src={m.imageUrl} alt="" className="w-full h-full object-cover" /> : m.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-800 dark:text-gray-300 truncate">{m.name}</div>
                                <div className="text-[10px] text-gray-400 truncate">{m.role}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="text-center mt-3"><Link href="/team" className="text-xs text-orange-600 underline">Gérer les équipes →</Link></div>
          </div>
      </div>

      {/* =======================
          VUE PDF
         ======================= */}
      <div className="hidden print:block bg-white text-black w-full">
          <div className="flex items-start gap-4 mb-4 border-b border-gray-300 pb-4">
             <img src="/icon-192.png" alt="Logo" className="w-16 h-16 rounded-lg object-cover" />
             <div className="flex-1">
                <h1 className="text-3xl font-black uppercase leading-none mb-1">{playlist.name}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-bold text-orange-600 uppercase">{formatDate(playlist.date)}</span>
                    {playlist.responsable && <span>• Resp: {playlist.responsable}</span>}
                </div>
                {!printChords && <p className="text-[10px] text-gray-400 uppercase mt-1">Paroles seules</p>}
             </div>
          </div>

          <div className="flex flex-col gap-8">
              {(() => {
                 const renderSongItem = (song: any, index: number, label?: string) => (
                    <div key={song.id + index} className="break-inside-avoid w-full">
                        <div className="flex flex-col mb-1 border-l-4 border-slate-800 pl-3">
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-xl font-black uppercase leading-tight">{song.titre}</h3>
                                {label && <span className="text-[10px] font-bold uppercase bg-gray-200 px-1 rounded text-gray-600">{label}</span>}
                            </div>
                            <p className="text-sm font-bold text-gray-500">{song.artiste}</p>
                            {song.youtube && (<a href={song.youtube} target="_blank" className="text-[10px] text-blue-600 underline truncate block">{song.youtube}</a>)}
                        </div>
                        <div className="pl-4">{renderPrintContent(song.contenu)}</div>
                    </div>
                 );
                 if (isMesse) {
                     let songCounter = 0;
                     return MESSE_STRUCTURE.map(step => {
                         const stepSongIds = playlist.slots?.[step] || [];
                         const stepSongs = songs.filter(s => stepSongIds.includes(s.id));
                         if (stepSongs.length === 0) return null;
                         return stepSongs.map(song => { songCounter++; return renderSongItem(song, songCounter, step); });
                     });
                 } else {
                     return songs.map((song, idx) => renderSongItem(song, idx));
                 }
              })()}
          </div>
      </div>

      {/* MODAL PRINT */}
      {showPrintModal && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in print:hidden">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl transform scale-100">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2 text-center">🖨️ Options d'impression</h3>
                <p className="text-sm text-gray-500 text-center mb-6">Quel format souhaitez-vous générer ?</p>
                <div className="flex flex-col gap-3">
                    <button onClick={() => triggerPrint(true)} className="flex items-center justify-center gap-3 p-4 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-xl transition-all group">
                        <span className="text-2xl">🎸</span>
                        <div className="text-left"><div className="font-bold text-orange-800 dark:text-orange-400 group-hover:text-orange-900">Paroles + Accords</div><div className="text-xs text-orange-600/70 dark:text-orange-400/60">Pour les musiciens</div></div>
                    </button>
                    <button onClick={() => triggerPrint(false)} className="flex items-center justify-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-xl transition-all group">
                        <span className="text-2xl">📄</span>
                        <div className="text-left"><div className="font-bold text-gray-800 dark:text-gray-200 group-hover:text-black">Paroles seules</div><div className="text-xs text-gray-500">Pour l'assemblée ou les chanteurs</div></div>
                    </button>
                </div>
                <button onClick={() => setShowPrintModal(false)} className="w-full mt-4 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">Annuler</button>
            </div>
         </div>
      )}

      {/* MODAL RECHERCHE */}
      {showSearch && (
        <div className="print:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl h-[80vh] sm:h-[600px] shadow-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-950">
                    <h3 className="font-bold text-slate-800 dark:text-white">Ajouter : <span className="text-orange-600">{targetSlot || 'Chant'}</span></h3>
                    <button onClick={() => setShowSearch(false)} className="text-gray-400">Fermer</button>
                </div>
                <div className="p-3 border-b dark:border-slate-800"><input autoFocus type="text" placeholder="Rechercher..." className="w-full p-3 bg-gray-100 dark:bg-slate-800 rounded-xl outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {allSongsIndex.filter(s => s.titre.toLowerCase().includes(searchTerm.toLowerCase())).map(song => (
                        <button key={song.id} onClick={() => addSongToPlaylist(song)} className="w-full text-left p-3 rounded-lg hover:bg-orange-50 dark:hover:bg-slate-800 flex justify-between items-center group">
                            <div><div className="font-bold text-slate-800 dark:text-gray-200 uppercase">{song.titre}</div><div className="text-xs text-gray-500">{song.artiste}</div></div>
                            <span className="text-xs font-bold text-gray-300 group-hover:text-orange-600 bg-gray-100 dark:bg-slate-900 px-2 py-1 rounded">{song.cle}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {isEditing && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                <h3 className="font-bold text-lg mb-4 dark:text-white">Modifier les infos</h3>
                <form onSubmit={handleUpdate} className="space-y-4">
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Nom</label><input type="text" className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-white" value={editName} onChange={e => setEditName(e.target.value)} /></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Date</label><input type="date" className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-white" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
                    {isMesse && (<div><label className="text-xs font-bold text-gray-500 uppercase">Responsable</label><input type="text" className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-white" value={editResponsable} onChange={e => setEditResponsable(e.target.value)} /></div>)}
                    <div><label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><span>🔗 Lien / Dossier Drive</span></label><input type="text" placeholder="https://..." className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-white text-sm" value={editLink} onChange={e => setEditLink(e.target.value)} /></div>
                    <div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-lg font-bold">Annuler</button><button type="submit" className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-bold">Valider</button></div>
                </form>
            </div>
        </div>
      )}
    </main>
  );
}