// lib/backupService.ts
import { collection, getDocs, writeBatch, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// --- EXPORT ---
export const exportData = async (type: 'all' | 'category' | 'single', target?: string) => {
  try {
    let songsToExport: any[] = [];

    if (type === 'single' && target) {
      // 1. Export Unique
      const docRef = await getDoc(doc(db, "songs", target)); // target est l'ID
      if (docRef.exists()) songsToExport.push({ id: docRef.id, ...docRef.data() });
    
    } else if (type === 'category' && target) {
      // 2. Export Catégorie
      const q = query(collection(db, "songs"), where("categorie", "==", target));
      const snapshot = await getDocs(q);
      songsToExport = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    } else {
      // 3. Export Total
      const snapshot = await getDocs(collection(db, "songs"));
      songsToExport = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    if (songsToExport.length === 0) return alert("Aucune donnée à exporter.");

    // Création du fichier
    const dataStr = JSON.stringify(songsToExport, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // Téléchargement forcé via un lien invisible
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().split('T')[0];
    link.download = `songbook_backup_${type}_${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (e) {
    console.error("Erreur export:", e);
    alert("Erreur lors de l'exportation.");
  }
};

// --- IMPORT ---
export const importData = async (jsonContent: string) => {
  try {
    const songs = JSON.parse(jsonContent);
    if (!Array.isArray(songs)) throw new Error("Format invalide (pas une liste)");

    // Firebase limite les batchs à 500 opérations. On découpe.
    const BATCH_SIZE = 450; 
    const total = songs.length;
    let processed = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = songs.slice(i, i + BATCH_SIZE);

      chunk.forEach((song: any) => {
        // On nettoie l'ID pour ne pas l'écrire DANS le document, mais l'utiliser comme clé
        const { id, ...songData } = song;
        
        // Si le chant a un ID (exporté depuis ici), on l'écrase (mise à jour).
        // Sinon (fichier externe), on crée un nouvel ID.
        const ref = id ? doc(db, "songs", id) : doc(collection(db, "songs"));
        batch.set(ref, songData, { merge: true });
      });

      await batch.commit();
      processed += chunk.length;
    }

    return processed;
  } catch (e) {
    console.error("Erreur import:", e);
    throw e;
  }
};

// Helper pour getDoc nécessaire ci-dessus si pas importé
import { getDoc } from 'firebase/firestore';