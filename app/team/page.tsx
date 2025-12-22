'use client';

import { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<'musicians' | 'teams'>('musicians');
  const [musicians, setMusicians] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  
  // --- ÉTATS DU FORMULAIRE MUSICIEN ---
  const [showMusicianForm, setShowMusicianForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // ID si on édite

  // Champs
  const [name, setName] = useState('');
  const [role, setRole] = useState('Chanteur');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');     // NOUVEAU
  const [photoUrl, setPhotoUrl] = useState(''); // NOUVEAU

  // --- ÉTATS DU FORMULAIRE ÉQUIPE ---
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // CHARGEMENT DES DONNÉES
  useEffect(() => {
    const qMusicians = query(collection(db, "musicians"), orderBy("name"));
    const unsubMusicians = onSnapshot(qMusicians, (snapshot) => {
      setMusicians(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qTeams = query(collection(db, "teams"), orderBy("name"));
    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      setTeams(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubMusicians(); unsubTeams(); };
  }, []);

  // --- LOGIQUE MUSICIENS (AJOUT & ÉDITION) ---
  
  // 1. Ouvrir le formulaire en mode ÉDITION
  const handleEditClick = (musician: any) => {
    setEditingId(musician.id);
    setName(musician.name);
    setRole(musician.role);
    setPhone(musician.phone || '');
    setEmail(musician.email || '');
    setPhotoUrl(musician.imageUrl || '');
    setShowMusicianForm(true);
    // On scroll vers le haut pour voir le formulaire
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 2. Ouvrir le formulaire en mode CRÉATION
  const openCreateForm = () => {
    resetForm();
    setShowMusicianForm(true);
  };

  // 3. Soumettre le formulaire (Créer OU Mettre à jour)
  const handleMusicianSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const musicianData = {
      name,
      role,
      phone,
      email,
      imageUrl: photoUrl,
      updatedAt: new Date()
    };

    try {
        if (editingId) {
            // MODE UPDATE
            await updateDoc(doc(db, "musicians", editingId), musicianData);
        } else {
            // MODE CREATE
            await addDoc(collection(db, "musicians"), {
                ...musicianData,
                createdAt: new Date()
            });
        }
        resetForm();
        setShowMusicianForm(false);
    } catch (e) {
        alert("Erreur lors de l'enregistrement");
    }
  };

  const handleDeleteMusician = async (id: string) => {
    if (confirm("Supprimer ce musicien ? Cela le retirera aussi des équipes.")) await deleteDoc(doc(db, "musicians", id));
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setRole('Chanteur');
    setPhone('');
    setEmail('');
    setPhotoUrl('');
  };

  // --- ACTIONS ÉQUIPES ---
  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    await addDoc(collection(db, "teams"), {
      name: newTeamName,
      members: selectedMembers,
      createdAt: new Date()
    });
    setNewTeamName(''); setSelectedMembers([]); setIsAddingTeam(false);
  };

  const toggleMemberSelection = (id: string) => {
    if (selectedMembers.includes(id)) setSelectedMembers(selectedMembers.filter(m => m !== id));
    else setSelectedMembers([...selectedMembers, id]);
  };

  const handleDeleteTeam = async (id: string) => {
    if (confirm("Supprimer cette équipe ?")) await deleteDoc(doc(db, "teams", id));
  };

  const getTeamMemberNames = (memberIds: string[]) => {
    if(!memberIds || memberIds.length === 0) return "Aucun membre";
    return memberIds.map(id => musicians.find(m => m.id === id)?.name).filter(Boolean).join(', ');
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 p-4 transition-colors duration-300">
      <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
        <span>👥</span> Équipe & Musiciens
      </h1>

      {/* TABS */}
      <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm mb-6 border border-gray-200 dark:border-slate-800">
        <button onClick={() => setActiveTab('musicians')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'musicians' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 shadow-sm' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
            🎸 Musiciens
        </button>
        <button onClick={() => setActiveTab('teams')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'teams' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 shadow-sm' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
            🛡️ Équipes
        </button>
      </div>

      {/* --- ONGLET MUSICIENS --- */}
      {activeTab === 'musicians' && (
        <div className="animate-in fade-in">
             {!showMusicianForm ? (
                <button onClick={openCreateForm} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-slate-900 mb-4">+ Ajouter un musicien</button>
             ) : (
                <form onSubmit={handleMusicianSubmit} className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-lg border border-orange-200 dark:border-slate-800 mb-6 relative">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-3">
                        {editingId ? "✏️ Modifier le profil" : "✨ Nouveau musicien"}
                    </h3>
                    
                    <div className="space-y-3">
                        {/* Ligne 1 : Photo & Nom */}
                        <div className="flex gap-3">
                            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex-shrink-0 overflow-hidden border border-gray-200 flex items-center justify-center">
                                {photoUrl ? (
                                    <img src={photoUrl} alt="Aperçu" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                ) : <span className="text-gray-400 text-xs text-center">No<br/>Img</span>}
                            </div>
                            <div className="flex-1 space-y-2">
                                <input autoFocus placeholder="Nom Prénom" className="w-full p-2 bg-gray-50 dark:bg-slate-800 border rounded-lg outline-none focus:border-orange-500 text-slate-800 dark:text-white" value={name} onChange={e => setName(e.target.value)} />
                                <input placeholder="Lien photo (https://...)" className="w-full p-2 text-xs bg-gray-50 dark:bg-slate-800 border rounded-lg outline-none text-slate-800 dark:text-white" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} />
                            </div>
                        </div>

                        {/* Ligne 2 : Rôle */}
                        <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border rounded-lg outline-none text-slate-800 dark:text-white">
                            <option>Chanteur</option>
                            <option>Instrumentiste</option>
                            <option>Animateur</option>
                            <option>Technique</option>
                        </select>

                        {/* Ligne 3 : Contacts */}
                        <div className="grid grid-cols-2 gap-2">
                            <input placeholder="Email" type="email" className="p-2 bg-gray-50 dark:bg-slate-800 border rounded-lg outline-none focus:border-orange-500 text-slate-800 dark:text-white" value={email} onChange={e => setEmail(e.target.value)} />
                            <input placeholder="Téléphone" className="p-2 bg-gray-50 dark:bg-slate-800 border rounded-lg outline-none focus:border-orange-500 text-slate-800 dark:text-white" value={phone} onChange={e => setPhone(e.target.value)} />
                        </div>

                        {/* Boutons */}
                        <div className="flex gap-2 pt-2">
                            <button type="button" onClick={() => { resetForm(); setShowMusicianForm(false); }} className="flex-1 py-2 bg-gray-100 dark:bg-slate-800 rounded-lg font-bold text-sm text-gray-500">Annuler</button>
                            <button type="submit" className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-bold text-sm">
                                {editingId ? "Enregistrer les modifications" : "Ajouter le membre"}
                            </button>
                        </div>
                    </div>
                </form>
             )}

             <div className="space-y-2">
                {musicians.length === 0 && <p className="text-center text-gray-400 py-4">Aucun musicien inscrit.</p>}
                
                {musicians.map(m => (
                    <div key={m.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-slate-800 flex justify-between items-center shadow-sm hover:shadow-md transition-all group">
                        <div className="flex gap-3 items-center overflow-hidden">
                            {/* AVATAR OU PHOTO */}
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 overflow-hidden ${m.role === 'Chanteur' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                {m.imageUrl ? (
                                    <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                                ) : (
                                    m.name.charAt(0)
                                )}
                            </div>
                            
                            {/* INFOS */}
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-800 dark:text-white truncate">{m.name}</h3>
                                <div className="text-xs text-gray-500 flex flex-col">
                                    <span className="font-semibold text-orange-600/80">{m.role}</span>
                                    {m.phone && <span>📞 {m.phone}</span>}
                                    {m.email && <span className="truncate">📧 {m.email}</span>}
                                </div>
                            </div>
                        </div>

                        {/* ACTIONS (EDIT / DELETE) */}
                        <div className="flex gap-1 pl-2">
                            <button onClick={() => handleEditClick(m)} className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors" title="Modifier">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => handleDeleteMusician(m.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors" title="Supprimer">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                ))}
             </div>
        </div>
      )}

      {/* --- ONGLET ÉQUIPES (INCHANGÉ MAIS INCLUS) --- */}
      {activeTab === 'teams' && (
          <div className="animate-in fade-in">
            {!isAddingTeam ? (
                <button onClick={() => setIsAddingTeam(true)} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-slate-900 mb-4">+ Créer une équipe</button>
             ) : (
                <form onSubmit={handleAddTeam} className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-orange-200 dark:border-slate-800 mb-4">
                    <div className="space-y-3">
                        <input autoFocus placeholder="Nom de l'équipe (ex: Groupe Jeunes)" className="w-full p-2 bg-gray-50 dark:bg-slate-800 border rounded-lg outline-none focus:border-orange-500 text-slate-800 dark:text-white" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                        
                        <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded-lg max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-700">
                            <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Sélectionner les membres :</p>
                            <div className="space-y-1">
                                {musicians.map(m => (
                                    <label key={m.id} className="flex items-center gap-2 p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded cursor-pointer">
                                        <input type="checkbox" checked={selectedMembers.includes(m.id)} onChange={() => toggleMemberSelection(m.id)} className="rounded text-orange-600 focus:ring-orange-500" />
                                        <span className="text-sm dark:text-gray-300">{m.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button type="button" onClick={() => setIsAddingTeam(false)} className="flex-1 py-2 bg-gray-100 dark:bg-slate-800 rounded-lg font-bold text-sm text-gray-500">Annuler</button>
                            <button type="submit" className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-bold text-sm">Créer Équipe</button>
                        </div>
                    </div>
                </form>
             )}

            <div className="space-y-3">
                {teams.map(t => (
                    <div key={t.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm relative group">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white">{t.name}</h3>
                                <p className="text-sm text-gray-500 mt-1 leading-snug">
                                    {getTeamMemberNames(t.members)}
                                </p>
                            </div>
                            <div className="bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400 text-xs font-bold px-2 py-1 rounded">
                                {t.members?.length || 0}
                            </div>
                        </div>
                        <button onClick={() => handleDeleteTeam(t.id)} className="absolute top-2 right-12 text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                ))}
            </div>
          </div>
      )}
    </main>
  );
}