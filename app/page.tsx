'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface SongLite {
  id: string;
  titre: string;
  artiste: string;
  cle: string;
}

export default function Home() {
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        // Requête simple : 20 premiers chants triés par titre
        const q = query(collection(db, "songs"), orderBy("titre"), limit(20));
        const querySnapshot = await getDocs(q);
        const list: SongLite[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          list.push({ id: doc.id, titre: data.titre, artiste: data.artiste, cle: data.cle });
        });
        setSongs(list);
      } catch (e) {
        console.error("Erreur Firebase:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSongs();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-orange-600">🎵 Songbook V2</h1>
        <p className="text-gray-500 text-sm">Version Next.js + Tailwind</p>
      </header>

      {loading ? (
        <div className="flex justify-center p-10">Chargement...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {songs.map((song) => (
            <Link key={song.id} href={`/song/${song.id}`} className="block">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform">
                <h2 className="font-bold text-gray-800">{song.titre}</h2>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-orange-500 font-medium">{song.artiste}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md border">{song.cle}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}