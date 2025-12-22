'use client';

import { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // États d'affichage
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filterMode, setFilterMode] = useState<'active' | 'archived'>('active'); // NOUVEAU : Filtre Actif/Archive
  const [currentDate, setCurrentDate] = useState(new Date());

  // États Formulaire
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [type, setType] = useState<'priere' | 'messe'>('priere');
  const [category, setCategory] = useState('Louange');
  const [year, setYear] = useState('Année A');

  const priereCategories = ['Louange', 'Adoration', 'Groupe de Prière', 'Mission', 'Soirée'];
  const messeYears = ['Année A', 'Année B', 'Année C'];

  useEffect(() => {
    const q = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Tri par date d'événement
      list.sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        return 0;
      });

      setPlaylists(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const playlistData: any = {
      name: newName,
      date: newDate,
      createdAt: new Date(),
      type: type,
      songs: [],
      slots: {},
      archived: false // Par défaut, non archivé
    };

    if (type === 'priere') playlistData.category = category;
    else playlistData.liturgyYear = year;

    try {
      await addDoc(collection(db, "playlists"), playlistData);
      setNewName(''); setNewDate(''); setIsCreating(false);
      setType('priere'); setCategory('Louange');
    } catch (error) { alert("Erreur création"); }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (confirm("Supprimer définitivement cette playlist ?")) {
      await deleteDoc(doc(db, "playlists", id));
    }
  };

  // NOUVEAU : Fonction pour basculer l'état archivé
  const toggleArchive = async (id: string, currentStatus: boolean, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const action = currentStatus ? "désarchiver" : "archiver";
    if (confirm(`Voulez-vous ${action} cette liste ?`)) {
        await updateDoc(doc(db, "playlists", id), { archived: !currentStatus });
    }
  };

  // Calendrier helpers
  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDay = firstDay.getDay() - 1; 
    if (startDay === -1) startDay = 6;
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const monthName = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const calendarCells = getDaysInMonth();
  const todayStr = new Date().toISOString().split('T')[0];

  // FILTRAGE DES LISTES
  // On ne montre dans le calendrier et la liste principale QUE ce qui correspond au filtre
  const filteredPlaylists = playlists.filter(p => {
      if (filterMode === 'active') return !p.archived; // Affiche si archived est false ou undefined
      return p.archived === true;
  });

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 p-4 transition-colors duration-300">
      {/* HEADER AVEC ONGLETS PRINCIPAUX */}
      <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <span>{filterMode === 'active' ? '📅' : '📦'}</span> 
                {filterMode === 'active' ? 'Mes Listes' : 'Archives'}
            </h1>
            
            {/* Toggle Actives / Archives */}
            <div className="bg-gray-200 dark:bg-slate-800 p-1 rounded-lg flex text-xs font-bold">
                <button 
                    onClick={() => setFilterMode('active')}
                    className={`px-3 py-1 rounded-md transition-all ${filterMode === 'active' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-gray-500'}`}
                >
                    En cours
                </button>
                <button 
                    onClick={() => setFilterMode('archived')}
                    className={`px-3 py-1 rounded-md transition-all ${filterMode === 'archived' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-gray-500'}`}
                >
                    Archives
                </button>
            </div>
          </div>

          {/* Toggle Liste / Mois (Seulement si mode Active) */}
          {filterMode === 'active' && (
            <div className="flex justify-between items-center">
                {!isCreating ? (
                    <button 
                    onClick={() => setIsCreating(true)}
                    className="py-2 px-4 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors text-sm shadow-sm flex items-center gap-2"
                    >
                    <span>+ Créer</span>
                    </button>
                ) : <div></div>}

                <div className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-800 flex shadow-sm">
                    <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'text-gray-500'}`}>Liste</button>
                    <button onClick={() => setViewMode('calendar')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'calendar' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'text-gray-500'}`}>Mois</button>
                </div>
            </div>
          )}
      </div>

      {/* --- FORMULAIRE DE CRÉATION --- */}
      {isCreating && filterMode === 'active' && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm mb-6 border border-orange-100 dark:border-slate-800 animate-in fade-in">
          <div className="flex flex-col gap-4">
              <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg">
                  <button type="button" onClick={() => setType('priere')} className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${type === 'priere' ? 'bg-white dark:bg-slate-700 shadow text-orange-600' : 'text-gray-500'}`}>🙏 Prière</button>
                  <button type="button" onClick={() => setType('messe')} className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${type === 'messe' ? 'bg-white dark:bg-slate-700 shadow text-orange-600' : 'text-gray-500'}`}>⛪ Messe</button>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Nom</label>
                <input autoFocus type="text" className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-orange-500 text-slate-800 dark:text-white" placeholder={type === 'messe' ? "Ex: Messe de Rentrée..." : "Ex: Soirée Louange..."} value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              {type === 'priere' ? (
                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Type de prière</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none text-slate-800 dark:text-white">
                        {priereCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
              ) : (
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Année Liturgique</label>
                    <select value={year} onChange={e => setYear(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none text-slate-800 dark:text-white">
                        {messeYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                 </div>
              )}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                <input type="date" className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-orange-500 text-slate-800 dark:text-white" value={newDate} onChange={e => setNewDate(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-2 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-lg font-bold text-sm">Annuler</button>
                <button type="submit" className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-bold text-sm">Créer</button>
              </div>
          </div>
        </form>
      )}

      {/* --- VUE CALENDRIER (Uniquement pour Active et mode Calendar) --- */}
      {viewMode === 'calendar' && filterMode === 'active' && (
        <div className="animate-in fade-in">
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-t-xl border border-gray-200 dark:border-slate-800 border-b-0">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full">←</button>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white capitalize">{monthName}</h2>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full">→</button>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-b-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/50">
                    {['L','M','M','J','V','S','D'].map((d, i) => <div key={i} className="text-center py-2 text-xs font-bold text-gray-400">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 auto-rows-fr">
                    {calendarCells.map((date, idx) => {
                        if (!date) return <div key={idx} className="bg-gray-50/50 dark:bg-slate-950/30 border-r border-b border-gray-100 dark:border-slate-800/50 min-h-[80px]"></div>;
                        const dateStr = date.toISOString().split('T')[0];
                        // On utilise filteredPlaylists ici (donc seulement les actives)
                        const dayEvents = filteredPlaylists.filter(p => p.date === dateStr);
                        const isToday = dateStr === todayStr;
                        return (
                            <div key={idx} className={`border-r border-b border-gray-100 dark:border-slate-800/50 min-h-[80px] p-1 relative ${isToday ? 'bg-orange-50/30' : ''}`}>
                                <span className={`text-xs font-bold block mb-1 ${isToday ? 'text-orange-600' : 'text-gray-400'}`}>{date.getDate()}</span>
                                <div className="flex flex-col gap-1">
                                    {dayEvents.map(ev => (
                                        <Link key={ev.id} href={`/playlists/${ev.id}`}>
                                            <div className={`text-[10px] font-bold px-1 py-0.5 rounded truncate border cursor-pointer ${ev.type === 'messe' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-orange-100 text-orange-800 border-orange-200'}`}>
                                                {ev.name}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
      )}

      {/* --- VUE LISTE (Active ou Archivée) --- */}
      {(viewMode === 'list' || filterMode === 'archived') && (
        <div className="space-y-3 animate-in fade-in">
            {loading ? <p className="text-center text-gray-400">Chargement...</p> : 
            filteredPlaylists.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-gray-400">Aucune playlist {filterMode === 'active' ? 'active' : 'archivée'}.</p>
                    {filterMode === 'archived' && <p className="text-sm text-gray-500 mt-2">Pour archiver une liste, cliquez sur l'icône 📦 <br/>dans l'onglet "En cours".</p>}
                </div>
            ) :
            filteredPlaylists.map(playlist => {
            const today = new Date().toISOString().split('T')[0];
            const isPast = playlist.date && playlist.date < today;
            const d = playlist.date ? new Date(playlist.date) : null;
            const isMesse = playlist.type === 'messe';
            
            return (
                <Link key={playlist.id} href={`/playlists/${playlist.id}`} className="block group">
                <div className={`bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm flex justify-between items-center transition-all ${isPast && filterMode === 'active' ? 'opacity-75 grayscale' : ''} hover:border-orange-300 dark:hover:border-slate-600`}>
                    <div className="flex gap-3 items-center">
                        {d ? (
                            <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg border ${isMesse ? 'bg-purple-50 border-purple-100 text-purple-700' : 'bg-orange-50 border-orange-100 text-orange-700'}`}>
                                <span className="text-[10px] uppercase font-bold leading-none">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                                <span className="text-lg font-extrabold leading-none mt-1">{d.getDate()}</span>
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center text-2xl">📂</div>
                        )}

                        <div>
                            <h3 className="font-bold text-lg leading-tight text-slate-800 dark:text-gray-200">{playlist.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${isMesse ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {isMesse ? 'Messe' : 'Prière'}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {isMesse ? playlist.liturgyYear : playlist.category}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* BOUTON ARCHIVER / DESARCHIVER */}
                        <button 
                            onClick={(e) => toggleArchive(playlist.id, playlist.archived, e)} 
                            className="p-2 text-gray-300 hover:text-blue-500 transition-colors"
                            title={playlist.archived ? "Restaurer" : "Archiver"}
                        >
                            {playlist.archived ? (
                                // Icone Restaurer (Undo)
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                            ) : (
                                // Icone Archive Box
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                            )}
                        </button>

                        {/* BOUTON SUPPRIMER */}
                        <button onClick={(e) => handleDelete(playlist.id, e)} className="p-2 text-gray-300 hover:text-red-500 transition-colors" title="Supprimer définitivement">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>
                </Link>
            );
            })
            }
        </div>
      )}
    </main>
  );
}