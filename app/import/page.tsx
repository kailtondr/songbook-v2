'use client';

import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ImportPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'url' | 'text'>('url');
  const [loading, setLoading] = useState(false);
  
  // États pour URL
  const [url, setUrl] = useState('');
  
  // États pour Texte
  const [inputText, setInputText] = useState('');

  // --- MOTEUR 1 : IMPORT WEB (CifraClub) ---
  const fetchFromUrl = async () => {
    if (!url) return;
    setLoading(true);

    try {
      // Utilisation d'un proxy pour contourner les restrictions CORS (comme dans votre ancien code)
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) throw new Error("Impossible d'accéder à la page");
      
      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");

      // Sélecteurs spécifiques à CifraClub (basés sur votre ancien code)
      const title = doc.querySelector("h1.t1")?.textContent?.trim() || "Titre Inconnu";
      const artist = doc.querySelector("h2.t3")?.textContent?.trim() || "Artiste Inconnu";
      const key = doc.querySelector("#cifra_tom a")?.textContent?.trim() || "C";
      
      // Le contenu est souvent dans <pre>
      const rawContent = doc.querySelector(".cifra_cnt pre")?.textContent || "";

      if (!rawContent) throw new Error("Impossible de trouver les paroles/accords");

      // On convertit le contenu brut (souvent déjà aligné) en ChordPro
      const chordPro = smartChordProConversion(rawContent);

      await saveSong(title, artist, key, chordPro, "CifraClub");

    } catch (e: any) {
      alert("Erreur d'import : " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- MOTEUR 2 : CONVERSION INTELLIGENTE (Fusion) ---
  const smartChordProConversion = (text: string): string => {
    const lines = text.split('\n');
    let result: string[] = [];

    // Regex pour détecter une ligne qui ne contient QUE des accords et des espaces
    // Ex: "   C      G7     Am   "
    const isChordLineRegex = /^[\sA-G#bmsuadi0-9\/\+\-\(\)]*$/;
    
    // Regex pour trouver un accord individuel
    const findChordRegex = /([A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?(?:7|9|11|13)?(?:\/[A-G][#b]?)?)/g;

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      // On ignore les lignes vides
      if (!currentLine.trim()) {
        result.push(""); 
        continue;
      }

      // Est-ce une ligne d'accords ?
      // Critères : Match regex d'accords ET contient au moins un accord reconnaissable
      const looksLikeChords = isChordLineRegex.test(currentLine) && /[A-G]/.test(currentLine);

      if (looksLikeChords && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        
        // Si la ligne suivante n'est PAS une ligne d'accords (donc c'est des paroles)
        // Et qu'elle n'est pas vide
        if (!isChordLineRegex.test(nextLine) && nextLine.trim().length > 0) {
            
            // --- ALGORITHME DE FUSION ---
            let mergedLine = "";
            let lastIndex = 0;
            let match;

            // On parcourt tous les accords de la ligne d'accords
            while ((match = findChordRegex.exec(currentLine)) !== null) {
                const chord = match[1];
                const chordIndex = match.index;

                // 1. On ajoute le texte des paroles qui se trouve AVANT cet accord
                // (Mais seulement ce qu'on n'a pas déjà ajouté)
                if (chordIndex > lastIndex) {
                    // Si l'accord est plus loin que la longueur du texte, on prend tout le texte
                    if (chordIndex > nextLine.length) {
                         mergedLine += nextLine.substring(lastIndex);
                         lastIndex = nextLine.length; 
                    } else {
                         mergedLine += nextLine.substring(lastIndex, chordIndex);
                         lastIndex = chordIndex;
                    }
                }

                // 2. On insère l'accord entre crochets
                mergedLine += `[${chord}]`;
            }

            // 3. On ajoute la fin de la phrase (s'il en reste)
            if (lastIndex < nextLine.length) {
                mergedLine += nextLine.substring(lastIndex);
            }

            result.push(mergedLine);
            i++; // IMPORTANT : On saute la ligne de paroles puisqu'on l'a fusionnée
        } else {
            // Ligne d'accord orpheline (Intro ou Instrumental)
            // On met simplement des crochets autour des accords
            result.push(currentLine.replace(findChordRegex, '[$1]'));
        }
      } else {
        // C'est une ligne normale (paroles seules ou accord orphelin en fin de fichier)
        if (looksLikeChords) {
             result.push(currentLine.replace(findChordRegex, '[$1]'));
        } else {
             result.push(currentLine);
        }
      }
    }
    return result.join('\n');
  };

  const handleTextImport = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    
    // Si l'utilisateur colle déjà du ChordPro (déjà des crochets), on ne touche pas trop
    // Sinon on lance la conversion intelligente
    const processedContent = inputText.includes('[') && inputText.includes(']') 
        ? inputText 
        : smartChordProConversion(inputText);

    // Essai de deviner le titre (1ère ligne non vide)
    const lines = processedContent.split('\n').filter(l => l.trim().length > 0);
    const titreEstime = lines[0]?.replace(/[\[\]]/g, '').trim() || "Chant Importé";

    await saveSong(titreEstime, "Inconnu", "C", processedContent, "Presse-papier");
    setLoading(false);
  };

  // --- FONCTION COMMUNE DE SAUVEGARDE ---
  const saveSong = async (titre: string, artiste: string, cle: string, contenu: string, source: string) => {
    try {
        const docRef = await addDoc(collection(db, "songs"), {
            titre,
            artiste,
            cle: cle.replace(/\s/g, ''), // Nettoyage
            contenu,
            categorie: "Import",
            source,
            createdAt: new Date()
        });
        router.push(`/edit/${docRef.id}`);
    } catch (e) {
        console.error(e);
        alert("Erreur lors de l'enregistrement dans Firebase");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-white sticky top-0 z-10 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        <Link href="/add" className="text-gray-500 font-bold text-sm">Annuler</Link>
        <h1 className="font-bold text-slate-800 flex-1 text-center">Importer</h1>
        <div className="w-10"></div>
      </header>

      {/* TABS */}
      <div className="flex p-4 gap-2 max-w-lg mx-auto">
        <button 
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'url' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-gray-500 border'}`}
        >
            🌐 Via URL
        </button>
        <button 
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'text' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-gray-500 border'}`}
        >
            📋 Copier/Coller
        </button>
      </div>

      <div className="px-4 max-w-lg mx-auto">
        
        {/* --- FORMULAIRE URL --- */}
        {activeTab === 'url' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="text-center mb-2">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl">🎸</div>
                    <h3 className="font-bold text-slate-800">CifraClub Downloader</h3>
                    <p className="text-xs text-gray-400">Collez le lien d'un chant CifraClub</p>
                </div>
                
                <input 
                    type="url" 
                    placeholder="https://www.cifraclub.com.br/..." 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 text-sm text-slate-800"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                />
                
                <button 
                    onClick={fetchFromUrl}
                    disabled={loading || !url}
                    className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {loading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Analyse...</span>
                        </>
                    ) : (
                        <span>🚀 Importer</span>
                    )}
                </button>
            </div>
        )}

        {/* --- FORMULAIRE TEXTE --- */}
        {activeTab === 'text' && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                 <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-800">
                    <span className="font-bold">Conversion Intelligente :</span> Copiez un texte avec les accords au-dessus des paroles, l'outil va essayer de les fusionner automatiquement !
                </div>

                <textarea 
                    className="w-full h-[50vh] p-4 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-orange-500 font-mono text-xs text-slate-800 leading-relaxed"
                    placeholder={"G       D       Em\nAlléluia, le Seigneur règne..."}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                ></textarea>

                <button 
                    onClick={handleTextImport}
                    disabled={loading || !inputText}
                    className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 disabled:opacity-50"
                >
                    {loading ? 'Conversion...' : '⚡ Convertir & Sauvegarder'}
                </button>
            </div>
        )}

      </div>
    </main>
  );
}
