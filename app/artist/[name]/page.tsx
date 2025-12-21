'use client';

import { useEffect, useState, use } from 'react';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/authContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// --- Icônes ---
const IconBack = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>;
const IconEdit = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
const IconMagic = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;

export default function ArtistPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const artistName = decodeURIComponent(name); 
  
  const { user } = useAuth();
  const router = useRouter();
  
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États Édition & Image
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(artistName);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [processing, setProcessing] = useState(false);

  // État Image Affichage
  const [artistImage, setArtistImage] = useState('');
  const [imageLoading, setImageLoading] = useState(false);

  // 1. Charger les chants ET l'image de l'artiste
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // A. Récupérer les chants (Sans orderBy pour éviter l'erreur d'index)
        const q = query(
            collection(db, "songs"), 
            where("artiste", "==", artistName)
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        list.sort((a: any, b: any) => (a.titre || "").localeCompare(b.titre || ""));
        setSongs(list);

        // B. Récupérer l'image
        const artistDocId = artistName.replace(/\//g, '-'); 
        const artistDoc = await getDoc(doc(db, "artists", artistDocId));
        if (artistDoc.exists() && artistDoc.data().imageUrl) {
            setArtistImage(artistDoc.data().imageUrl);
            setEditImageUrl(artistDoc.data().imageUrl); // Pré-remplir le champ d'édition
        }

      } catch (e) {
        console.error("Erreur chargement:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [artistName]);

  // --- COEUR DU SYSTÈME : Mise à jour Globale (Nom + Image) ---
  const performGlobalUpdate = async (targetName: string, targetImage: string) => {
    setProcessing(true);
    try {
        const batch = writeBatch(db);
        
        // 1. Si le nom change, on met à jour TOUS les chants
        if (targetName !== artistName) {
            songs.forEach(song => {
                const songRef = doc(db, "songs", song.id);
                batch.update(songRef, { artiste: targetName.trim() });
            });
        }

        // 2. Mise à jour du Document Artiste (Image + Nom)
        const oldDocId = artistName.replace(/\//g, '-');
        const newDocId = targetName.trim().replace(/\//g, '-');

        if (targetName !== artistName) {
            // Migration vers le nouveau nom : Créer nouveau, supprimer ancien
            batch.set(doc(db, "artists", newDocId), { 
                name: targetName.trim(), 
                imageUrl: targetImage, 
                updatedAt: new Date() 
            });
            batch.delete(doc(db, "artists", oldDocId));
        } else {
            // Mise à jour simple (Image)
            batch.set(doc(db, "artists", newDocId), { 
                name: targetName, 
                imageUrl: targetImage, 
                updatedAt: new Date() 
            }, { merge: true });
        }

        await batch.commit();
        
        if (targetName !== artistName) {
            alert(`Artiste renommé en "${targetName}" ! Redirection...`);
            router.replace(`/artist/${encodeURIComponent(targetName.trim())}`);
        } else {
            setArtistImage(targetImage);
            alert("Image mise à jour !");
            setIsEditing(false);
        }

    } catch (e) {
        console.error(e);
        alert("Erreur lors de la sauvegarde.");
    } finally {
        setProcessing(false);
        setImageLoading(false);
    }
  };

  // --- SCRIPT INTELLIGENT DEEZER ---
  const fetchAutoImage = async () => {
    if (!user) return alert("Connectez-vous pour modifier l'image.");
    setImageLoading(true);

    try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://api.deezer.com/search/artist?q=${artistName}`)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            const bestMatch = data.data[0];
            const imageUrl = bestMatch.picture_xl || bestMatch.picture_medium;
            const deezerName = bestMatch.name;

            // INTELLIGENCE : Si le nom Deezer est différent (ex: correction ortho), on propose
            if (deezerName.toLowerCase() !== artistName.toLowerCase()) {
                if (confirm(`Deezer suggère le nom officiel : "${deezerName}" (au lieu de "${artistName}").\n\nVoulez-vous RENOMMER l'artiste et utiliser sa photo ?`)) {
                    await performGlobalUpdate(deezerName, imageUrl);
                    return;
                }
            }

            // Sinon, on met juste à jour l'image
            await performGlobalUpdate(artistName, imageUrl);
            
        } else {
            alert("Aucune image trouvée sur Deezer. Essayez d'ajouter une URL manuellement via le bouton 'Gérer l'artiste'.");
            setIsEditing(true); // Ouvre la modale pour l'ajout manuel
        }
    } catch (e) {
        console.error(e);
        alert("Erreur réseau Deezer.");
    } finally {
        setImageLoading(false);
    }
  };

  // Gestion soumission formulaire manuel
  const handleManualSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      performGlobalUpdate(editName, editImageUrl);
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500 dark:text-gray-400">Chargement...</div>;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 transition-colors duration-300">
      
      {/* HEADER AVEC IMAGE */}
      <div className="relative bg-slate-900 text-white overflow-hidden shadow-md min-h-[250px] flex flex-col justify-end">
        {artistImage ? (
            <div className="absolute inset-0 bg-cover bg-center opacity-50 blur-xl scale-110 transition-all duration-700" style={{ backgroundImage: `url(${artistImage})` }}></div>
        ) : (
            <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-orange-600 to-purple-800"></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
        
        <div className="absolute top-6 left-4 z-20">
             <Link href="/" className="inline-flex items-center gap-1 text-white/90 hover:text-white text-sm font-bold bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-md transition-colors border border-white/10 hover:bg-black/40">
                <IconBack /> Retour
            </Link>
        </div>

        <div className="relative z-10 px-6 py-8 flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
            <div className="relative group shrink-0">
                <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full shadow-2xl border-4 border-white/10 bg-slate-800 flex items-center justify-center overflow-hidden ${imageLoading ? 'animate-pulse' : ''}`}>
                    {artistImage ? (
                        <img src={artistImage} alt={artistName} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-4xl font-bold text-white/20">{artistName.charAt(0)}</span>
                    )}
                </div>
                
                {/* Bouton Baguette Magique (Deezer) */}
                {user && (
                    <button 
                        onClick={fetchAutoImage}
                        disabled={imageLoading}
                        className="absolute bottom-0 right-0 bg-orange-600 text-white p-2 rounded-full shadow-lg hover:bg-orange-500 hover:scale-110 transition-all border-2 border-slate-900 z-20"
                        title="Chercher image auto (Deezer)"
                    >
                        {imageLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <IconMagic />}
                    </button>
                )}
            </div>
            
            <div className="flex-1 mb-2">
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-2 text-white drop-shadow-md">{artistName}</h1>
                <p className="text-white/80 font-medium text-sm flex items-center justify-center md:justify-start gap-3">
                    <span className="bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">{songs.length} chants</span>
                    {user && (
                        <button onClick={() => { setEditName(artistName); setIsEditing(true); }} className="hover:text-white hover:underline transition-colors flex items-center gap-1 text-xs opacity-70">
                            <IconEdit /> Gérer l'artiste
                        </button>
                    )}
                </p>
            </div>
        </div>
      </div>

      {/* LISTE DES CHANTS */}
      <div className="p-4 max-w-4xl mx-auto space-y-3 relative z-20">
        {songs.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-gray-300 dark:border-slate-800">
                <p className="text-gray-400 dark:text-gray-500 mb-2">Aucun chant trouvé pour cet artiste.</p>
            </div>
        ) : (
            songs.map((song) => (
                <Link key={song.id} href={`/song/${song.id}`} className="block group">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all flex justify-between items-center hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-md">
                        <div className="flex-1 min-w-0 pr-4">
                            <h2 className="font-bold text-gray-800 dark:text-gray-100 text-lg truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{song.titre}</h2>
                            {song.categorie && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-wide font-bold">{song.categorie}</p>}
                        </div>
                        <span className="w-9 h-9 flex items-center justify-center text-sm font-extrabold bg-gray-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg border border-gray-200 dark:border-slate-700">{song.cle || '?'}</span>
                    </div>
                </Link>
            ))
        )}
      </div>

      {/* MODAL GESTION (Nom + Image Manuelle) */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border dark:border-slate-800 transform scale-100">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Gérer l'artiste</h3>
                
                <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Nom</label>
                        <input 
                            type="text" 
                            className="w-full p-3 border border-gray-300 dark:border-slate-700 dark:bg-slate-950 rounded-xl text-slate-800 dark:text-white font-bold outline-none focus:border-orange-500"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">URL Image (Optionnel)</label>
                        <input 
                            type="text" 
                            placeholder="https://..."
                            className="w-full p-3 border border-gray-300 dark:border-slate-700 dark:bg-slate-950 rounded-xl text-sm text-slate-800 dark:text-white outline-none focus:border-orange-500"
                            value={editImageUrl}
                            onChange={e => setEditImageUrl(e.target.value)}
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Laissez vide ou utilisez la baguette magique pour Deezer.</p>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Annuler
                        </button>
                        <button 
                            type="submit"
                            disabled={processing}
                            className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-colors shadow-lg shadow-orange-600/20"
                        >
                            {processing ? '...' : 'Sauvegarder'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </main>
  );
}