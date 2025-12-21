'use client';

import { useState, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ChordToolbar from '@/components/music/ChordToolbar'; // <-- IMPORT

export default function AddSong() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [titre, setTitre] = useState('');
  const [artiste, setArtiste] = useState('');
  const [cle, setCle] = useState('C');
  const [contenu, setContenu] = useState('');
  const [categorie, setCategorie] = useState('');

  // Fonction d'insertion (identique)
  const handleInsert = (textToInsert: string, cursorOffset = 0) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = textarea.value.substring(0, start) + textToInsert + textarea.value.substring(end);
    setContenu(newValue);
    setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + textToInsert.length - cursorOffset;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre || !contenu) return alert("Le titre et le contenu sont obligatoires");

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "songs"), {
        titre, artiste: artiste || "Inconnu", cle, contenu,
        categorie: categorie || "Divers", createdAt: new Date()
      });
      router.push(`/song/${docRef.id}`);
    } catch (error) {
      alert("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 sticky top-0 z-30 px-4 py-3 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
        <Link href="/" className="text-gray-500 dark:text-gray-400 font-bold text-sm">Annuler</Link>
        <h1 className="font-bold text-slate-800 dark:text-white">Nouveau Chant</h1>
        <button onClick={handleSubmit} disabled={loading} className="text-orange-600 dark:text-orange-400 font-bold text-sm disabled:opacity-50">
            {loading ? '...' : 'Enregistrer'}
        </button>
      </header>

      {/* Import Rapide */}
      <div className="p-4 pb-0 max-w-lg mx-auto">
          <Link href="/import" className="block w-full py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-slate-600 dark:text-gray-300 font-bold text-center rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
              ⚡ Importer depuis le presse-papier
          </Link>
          <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-slate-800"></div></div>
              <span className="relative px-2 bg-gray-50 dark:bg-slate-950 text-xs text-gray-400 uppercase">Ou créer manuellement</span>
          </div>
      </div>

      {/* BARRE D'OUTILS ACCORDS */}
      <ChordToolbar content={contenu} onInsert={handleInsert} />

      <form className="p-4 space-y-4 max-w-lg mx-auto pt-0">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 space-y-3">
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Titre</label>
                <input type="text" placeholder="Ex: Grâce Infinie" className="w-full text-lg font-bold border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent" value={titre} onChange={e => setTitre(e.target.value)} />
            </div>
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Artiste</label>
                    <input type="text" placeholder="Ex: Hillsong" className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent" value={artiste} onChange={e => setArtiste(e.target.value)} />
                </div>
                <div className="w-24">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Clé</label>
                    <select className="w-full text-sm font-bold border-b border-gray-200 dark:border-slate-700 pb-2 bg-transparent text-slate-800 dark:text-white outline-none" value={cle} onChange={e => setCle(e.target.value)}>
                        {["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"].map(k => <option key={k} value={k} className="dark:bg-slate-800">{k}</option>)}
                    </select>
                </div>
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Catégorie</label>
                <input type="text" placeholder="Ex: Louange..." className="w-full text-sm border-b border-gray-200 dark:border-slate-700 pb-2 outline-none text-slate-800 dark:text-white bg-transparent" value={categorie} onChange={e => setCategorie(e.target.value)} />
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col h-[60vh]">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase flex justify-between">
                <span>Paroles et Accords</span>
                <span className="text-[10px] bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded text-gray-500">Format ChordPro</span>
            </label>
            <textarea 
                ref={textareaRef}
                className="flex-1 w-full font-mono text-sm leading-relaxed p-2 bg-gray-50 dark:bg-slate-950 rounded-lg border border-transparent outline-none resize-none text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/20"
                placeholder="[G]Dieu est [C]bon..."
                value={contenu}
                onChange={e => setContenu(e.target.value)}
            ></textarea>
        </div>
      </form>
    </main>
  );
}