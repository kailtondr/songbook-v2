'use client';

import { useState, useEffect, use } from 'react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EditSong({ params }: { params: Promise<{ id: string }> }) {
  // Déballage de l'ID pour Next.js 15
  const { id } = use(params);
  
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Champs du formulaire
  const [titre, setTitre] = useState('');
  const [artiste, setArtiste] = useState('');
  const [cle, setCle] = useState('C');
  const [contenu, setContenu] = useState('');
  const [categorie, setCategorie] = useState('');

  // 1. Charger les données existantes
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
        } else {
          alert("Chant introuvable");
          router.push('/');
        }
      } catch (e) {
        console.error("Erreur chargement:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, router]);

  // 2. Sauvegarder les modifications
  const handleUpdate = async () => {
    if (!titre || !contenu) return alert("Le titre et le contenu sont requis");
    setSaving(true);
    try {
      const docRef = doc(db, "songs", id);
      await updateDoc(docRef, {
        titre,
        artiste,
        cle,
        contenu,
        categorie,
        updatedAt: new Date()
      });
      router.push(`/song/${id}`); // Retour au chant
    } catch (e) {
      alert("Erreur lors de la modification");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // 3. Supprimer le chant
  const handleDelete = async () => {
    if (confirm("Voulez-vous vraiment supprimer ce chant définitivement ?")) {
      try {
        await deleteDoc(doc(db, "songs", id));
        router.push('/'); // Retour accueil
      } catch (e) {
        alert("Erreur suppression");
      }
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">Chargement...</div>;

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <Link href={`/song/${id}`} className="text-gray-500 font-bold text-sm">Annuler</Link>
        <h1 className="font-bold text-slate-800">Modifier</h1>
        <button 
            onClick={handleUpdate} 
            disabled={saving}
            className="text-orange-600 font-bold text-sm disabled:opacity-50"
        >
            {saving ? '...' : 'Sauvegarder'}
        </button>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Titre</label>
                <input type="text" className="w-full text-lg font-bold border-b border-gray-200 pb-2 outline-none text-slate-800"
                    value={titre} onChange={e => setTitre(e.target.value)} />
            </div>
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Artiste</label>
                    <input type="text" className="w-full text-sm border-b border-gray-200 pb-2 outline-none text-slate-800"
                        value={artiste} onChange={e => setArtiste(e.target.value)} />
                </div>
                <div className="w-24">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Clé</label>
                    <select className="w-full text-sm font-bold border-b border-gray-200 pb-2 bg-transparent text-slate-800"
                        value={cle} onChange={e => setCle(e.target.value)}>
                        {["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                </div>
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Catégorie</label>
                <input type="text" className="w-full text-sm border-b border-gray-200 pb-2 outline-none text-slate-800"
                    value={categorie} onChange={e => setCategorie(e.target.value)} />
            </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[50vh]">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Paroles et Accords (ChordPro)</label>
            <textarea className="flex-1 w-full font-mono text-sm leading-relaxed p-2 bg-gray-50 rounded-lg border border-transparent outline-none resize-none text-slate-800"
                value={contenu} onChange={e => setContenu(e.target.value)}></textarea>
        </div>

        {/* Zone Danger */}
        <div className="pt-8">
            <button onClick={handleDelete} className="w-full py-3 text-red-600 font-bold bg-white border border-red-100 rounded-xl hover:bg-red-50">
                Supprimer ce chant
            </button>
        </div>

      </div>
    </main>
  );
}