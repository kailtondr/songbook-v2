'use client';

import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AddSong() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Champs du formulaire
  const [titre, setTitre] = useState('');
  const [artiste, setArtiste] = useState('');
  const [cle, setCle] = useState('C');
  const [contenu, setContenu] = useState('');
  const [categorie, setCategorie] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre || !contenu) return alert("Le titre et le contenu sont obligatoires");

    setLoading(true);
    try {
      // Envoi vers Firebase
      const docRef = await addDoc(collection(db, "songs"), {
        titre,
        artiste: artiste || "Inconnu",
        cle,
        contenu, // Format ChordPro
        categorie: categorie || "Divers",
        createdAt: new Date()
      });

      // Redirection vers le nouveau chant
      router.push(`/song/${docRef.id}`);
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <Link href="/" className="text-gray-500 font-bold text-sm">Annuler</Link>
        <h1 className="font-bold text-slate-800">Nouveau Chant</h1>
        <button 
            onClick={handleSubmit} 
            disabled={loading}
            className="text-orange-600 font-bold text-sm disabled:opacity-50"
        >
            {loading ? '...' : 'Enregistrer'}
        </button>
      </header>

      <form className="p-4 space-y-4 max-w-lg mx-auto">
        
        {/* Titre & Artiste */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Titre</label>
                <input 
                    type="text" 
                    placeholder="Ex: Grâce Infinie" 
                    className="w-full text-lg font-bold border-b border-gray-200 pb-2 focus:border-orange-500 outline-none text-slate-800"
                    value={titre}
                    onChange={e => setTitre(e.target.value)}
                />
            </div>
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Artiste</label>
                    <input 
                        type="text" 
                        placeholder="Ex: Hillsong" 
                        className="w-full text-sm border-b border-gray-200 pb-2 focus:border-orange-500 outline-none text-slate-800"
                        value={artiste}
                        onChange={e => setArtiste(e.target.value)}
                    />
                </div>
                <div className="w-24">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Clé</label>
                    <select 
                        className="w-full text-sm font-bold border-b border-gray-200 pb-2 bg-transparent text-slate-800"
                        value={cle}
                        onChange={e => setCle(e.target.value)}
                    >
                        {["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"].map(k => (
                            <option key={k} value={k}>{k}</option>
                        ))}
                    </select>
                </div>
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Catégorie</label>
                <input 
                    type="text" 
                    placeholder="Ex: Louange, Adoration..." 
                    className="w-full text-sm border-b border-gray-200 pb-2 focus:border-orange-500 outline-none text-slate-800"
                    value={categorie}
                    onChange={e => setCategorie(e.target.value)}
                />
            </div>
        </div>

        {/* Zone de texte (ChordPro) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[60vh]">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase flex justify-between">
                <span>Paroles et Accords</span>
                <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500">Format ChordPro</span>
            </label>
            <textarea 
                className="flex-1 w-full font-mono text-sm leading-relaxed p-2 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-orange-500 outline-none resize-none text-slate-800"
                placeholder="[G]Dieu est [C]bon..."
                value={contenu}
                onChange={e => setContenu(e.target.value)}
            ></textarea>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
                Mettez les accords entre crochets : [C], [Gm7]...
            </p>
        </div>

      </form>
    </main>
  );
}