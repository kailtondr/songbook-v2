'use client';

import { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function PlaylistsPage() {
  // On type explicitement en any[] pour éviter les erreurs de build
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');

  useEffect(() => {
    const q = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // CORRECTION ICI : on force le type 'any' pour dire à TypeScript que 'date' existe
      const list: any[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      list.sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
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
    try {
      await addDoc(collection(db, "playlists"), {
        name: newName,
        date: newDate,
        createdAt: new Date(),
        songs: []
      });
      setNewName(''); setNewDate(''); setIsCreating(false);
    } catch (error) { alert("Erreur création"); }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (confirm("Supprimer cette playlist ?")) {
      await deleteDoc(doc(db, "playlists", id));
    }
  };

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

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 p-4 transition-colors duration-300">
      {/* HEADER PAGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <span>📅</span> Mes Listes
          </h1>
          
          <div className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-800 flex shadow-sm self-start">
              <button 
                onClick={() => setViewMode('list')}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
              >
                Liste
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'calendar' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
              >
                Mois
              </button>
          </div>
      </div>

      {!isCreating && (
        <button 
          onClick={() => setIsCreating(true)}
          className="w-full py-3 bg-white dark:bg-slate-900 border-2 border-dashed border-orange-200 dark:border-orange-900 rounded-xl text-orange-600 dark:text-orange-400 font-bold hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors mb-6 flex items-center justify-center gap-2"
        >
          <span>+ Nouvelle Liste</span>
        </button>
      )}

      {isCreating && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm mb-6 border border-orange-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Nom</label>
                <input autoFocus type="text" className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-orange-500 text-slate-800 dark:text-white" placeholder="Ex: Culte..." value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Date</label>
                <input type="date" className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-orange-500 text-slate-800 dark:text-white" value={newDate} onChange={e => setNewDate(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-2 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-lg font-bold text-sm">Annuler</button>
                <button type="submit" className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-bold text-sm">Créer</button>
              </div>
          </div>
        </form>
      )}

      {/* --- VUE CALENDRIER --- */}
      {viewMode === 'calendar' && (
        <div className="animate-in fade-in">
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-t-xl border border-gray-200 dark:border-slate-800 border-b-0">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 font-bold">←</button>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white capitalize">{monthName}</h2>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 font-bold">→</button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-b-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/50">
                    {['L','M','M','J','V','S','D'].map((d, i) => (
                        <div key={i} className="text-center py-2 text-xs font-bold text-gray-400 dark:text-gray-500">{d}</div>
                    ))}
                </div>
                
                <div className="grid grid-cols-7 auto-rows-fr">
                    {calendarCells.map((date, idx) => {
                        if (!date) return <div key={idx} className="bg-gray-50/50 dark:bg-slate-950/30 border-r border-b border-gray-100 dark:border-slate-800/50 min-h-[80px]"></div>;
                        
                        const dateStr = date.toISOString().split('T')[0];
                        const dayEvents = playlists.filter(p => p.date === dateStr);
                        const isToday = dateStr === todayStr;

                        return (
                            <div key={idx} className={`border-r border-b border-gray-100 dark:border-slate-800/50 min-h-[80px] p-1 relative transition-colors ${isToday ? 'bg-orange-50/30 dark:bg-orange-900/10' : ''}`}>
                                <span className={`text-xs font-bold block mb-1 ${isToday ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-600'}`}>
                                    {date.getDate()}
                                </span>
                                
                                <div className="flex flex-col gap-1">
                                    {dayEvents.map(ev => (
                                        <Link key={ev.id} href={`/playlists/${ev.id}`}>
                                            <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-[10px] font-bold px-1 py-0.5 rounded truncate border border-orange-200 dark:border-orange-800 hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors cursor-pointer shadow-sm">
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
            <div className="text-center mt-4 text-xs text-gray-400 dark:text-gray-600">Cliquez sur un événement pour voir le détail.</div>
        </div>
      )}

      {/* --- VUE LISTE --- */}
      {viewMode === 'list' && (
        <div className="space-y-3 animate-in fade-in">
            {loading ? <p className="text-center text-gray-400 dark:text-gray-500">Chargement...</p> : 
            playlists.length === 0 ? <p className="text-center text-gray-400 dark:text-gray-500 py-10">Aucune playlist.</p> :
            playlists.map(playlist => {
            const today = new Date().toISOString().split('T')[0];
            const isPast = playlist.date && playlist.date < today;
            const d = playlist.date ? new Date(playlist.date) : null;
            
            return (
                <Link key={playlist.id} href={`/playlists/${playlist.id}`} className="block group">
                <div className={`bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm flex justify-between items-center transition-all ${isPast ? 'opacity-60 grayscale border-gray-100 dark:border-slate-800' : 'border-gray-100 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md'}`}>
                    <div className="flex gap-3 items-center">
                        {d ? (
                            <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg border ${isPast ? 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900 text-orange-700 dark:text-orange-400'}`}>
                                <span className="text-[10px] uppercase font-bold leading-none">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                                <span className="text-lg font-extrabold leading-none mt-1">{d.getDate()}</span>
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 flex items-center justify-center text-2xl">📂</div>
                        )}

                        <div>
                            <h3 className={`font-bold text-lg leading-tight ${isPast ? 'text-gray-500 dark:text-gray-500' : 'text-slate-800 dark:text-gray-200 group-hover:text-orange-600 dark:group-hover:text-orange-400'}`}>{playlist.name}</h3>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{playlist.songs?.length || 0} chants {isPast && " • Passé"}</p>
                        </div>
                    </div>

                    <button onClick={(e) => handleDelete(playlist.id, e)} className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
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