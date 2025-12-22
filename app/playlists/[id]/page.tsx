'use client';

import { useEffect, useState, use } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

// Structure liturgique
const MESSE_STRUCTURE = [
  "Entrée", "Acte pénitentiel", "Kyrie", "Psaume", "Acclamation", "PU", 
  "Offertoire", "Sanctus", "Adoration", "Amen", "Agnus Dei", 
  "Communion", "Action de grâces", "Sortie"
];

export default function PlaylistDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  // Données
  const [playlist, setPlaylist] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]); 
  const [teams, setTeams] = useState<any[]>([]);
  const [musicians, setMusicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLink, setEditLink] = useState(''); 
  const [editResponsable, setEditResponsable] = useState('');
  const [printChords, setPrintChords] = useState(true);

  // Recherche
  const [showSearch, setShowSearch] = useState(false);
  const [targetSlot, setTargetSlot] = useState<string | null>(null);
  const [allSongsIndex, setAllSongsIndex] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

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

  // 2. Index
  useEffect(() => {
    const loadIndex = async () => {
        const q = query(collection(db, "songs"), orderBy("titre"));
        const snapshot = await getDocs(q);
        setAllSongsIndex(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    if(showSearch && allSongsIndex.length === 0) loadIndex();
  }, [showSearch]);

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
    
    // CORRECTION TYPE: Ajout de (prev: any)
    setPlaylist((prev: any) => ({ ...prev, songs: newSongsIds, slots: newSlots }));
    
    // CORRECTION TYPE: Ajout de (prev: any[])
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

  // --- MOTEUR DE RENDU (Refrain + Accords) ---
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

  const handlePrint = () => window.print();
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
      
      {/* STYLE CSS SPÉCIFIQUE IMPRESSION */}
      <style jsx global>{`
        @media print {
          @page { margin: 1cm; size: auto; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, footer, header, .fixed, .sticky, [class*="fixed"], [class*="sticky"], [class*="bottom-0"], [class*="z-50"] { display: none !important; }
          .print\\:block { display: block !important; position: relative !important; z-index: 9999 !important; }
        }
      `}</style>

      {/* =======================
          VUE ÉCRAN (Compacte)
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
                <label className="hidden sm:flex items-center gap-2 mr-2 cursor-pointer bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700">
                    <input type="checkbox" checked={printChords} onChange={e => setPrintChords(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Accords PDF</span>
                </label>

                {playlist.externalLink && (
                    <a href={playlist.externalLink} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 dark:bg-blue-900/20" title="Ouvrir le dossier"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg></a>
                )}
                <button onClick={handlePrint} className="p-2 text-slate-600 bg-gray-100 rounded-full hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300" title="Imprimer / PDF"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg></button>
                <button onClick={handleShare} className="p-2 text-orange-600 bg-orange-50 rounded-full hover:bg-orange-100 dark:bg-orange-900/20"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></button>
                <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-slate-600 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
            </div>
          </header>

          <div className="p-4 space-y-6">
            <div className="sm:hidden mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={printChords} onChange={e => setPrintChords(e.target.checked)} className="rounded text-orange-600" />
                    <span className="text-xs font-bold text-gray-500 uppercase">Inclure les accords dans le PDF</span>
                </label>
            </div>

            {isMesse ? (
                <div className="space-y-1">
                    {MESSE_STRUCTURE.map((step) => {
                        const stepSongIds = playlist.slots?.[step] || [];
                        const stepSongs = songs.filter(s => stepSongIds.includes(s.id));
                        return (
                            <div key={step} className="mb-2">
                                {/* HEADER COMPACT SLOT */}
                                <div className="flex items-center gap-2 py-1 bg-gray-50/50 dark:bg-slate-900/50 px-2 rounded -mx-2">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase">{step}</h3>
                                    <button onClick={() => openSearch(step)} className="text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-full p-1 transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    </button>
                                </div>

                                {/* LISTE COMPACTE */}
                                <div className="pl-2 border-l-2 border-gray-100 dark:border-slate-800 ml-1">
                                    {stepSongs.length === 0 ? (
                                        <div onClick={() => openSearch(step)} className="text-[10px] text-gray-300 italic py-1 cursor-pointer hover:text-orange-500">Vide</div>
                                    ) : (
                                        stepSongs.map(song => (
                                            <div key={song.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-slate-800/50 last:border-0 group">
                                                <Link href={`/song/${song.id}`} className="flex-1 min-w-0">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{song.titre}</span>
                                                        <span className="text-[10px] font-mono text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-1 rounded">{song.cle}</span>
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 truncate">{song.artiste}</div>
                                                </Link>
                                                <button onClick={() => removeSong(song.id, step)} className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ))
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
                                             <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{song.titre}</span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 truncate">{song.artiste}</div>
                                    </Link>
                                </div>
                                <button onClick={() => removeSong(song.id)} className="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
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
          VUE PDF (INCHANGÉE)
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

      {/* MODALS */}
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
                            <div><div className="font-bold text-slate-800 dark:text-gray-200">{song.titre}</div><div className="text-xs text-gray-500">{song.artiste}</div></div>
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