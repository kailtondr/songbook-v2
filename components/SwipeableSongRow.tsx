'use client';

import { motion, useAnimation, PanInfo } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';

interface Props {
  song: any;
  onDelete: () => void;
  onAddToPlaylist: () => void;
}

export default function SwipeableSongRow({ song, onDelete, onAddToPlaylist }: Props) {
  const controls = useAnimation();
  const [isOpen, setIsOpen] = useState(false);

  // Ouverture pour 3 boutons (environ 150px)
  const OPEN_VALUE = -150; 

  const handleDragEnd = async (event: any, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -50 || velocity < -500) {
      await controls.start({ x: OPEN_VALUE, transition: { type: "spring", stiffness: 400, damping: 30 } });
      setIsOpen(true);
    } else {
      await controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
      setIsOpen(false);
    }
  };

  const closeSwipe = () => {
    controls.start({ x: 0 });
    setIsOpen(false);
  };

  return (
    <div className="relative w-full overflow-hidden border-b border-gray-200 dark:border-slate-800 last:border-0 bg-white dark:bg-slate-950">
      
      {/* ARRIÈRE-PLAN (LES BOUTONS) */}
      <div className="absolute top-0 right-0 bottom-0 flex w-[150px]">
        <Link href={`/edit/${song.id}`} onClick={closeSwipe} className="flex-1 bg-blue-500 flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </Link>
        <button onClick={() => { onAddToPlaylist(); closeSwipe(); }} className="flex-1 bg-orange-500 flex items-center justify-center text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
        <button onClick={() => { if(confirm('Supprimer ce chant ?')) onDelete(); closeSwipe(); }} className="flex-1 bg-red-600 flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      {/* AVANT-PLAN (DESIGN "IDEAL.PNG") */}
      <motion.div
        drag="x"
        dragConstraints={{ left: OPEN_VALUE, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative bg-white dark:bg-slate-950 z-10 w-full"
      >
        <Link href={`/song/${song.id}`} className="block py-3 pl-3 pr-2 active:bg-gray-50 dark:active:bg-slate-900 transition-colors">
            <div className="flex items-start justify-between gap-2">
                
                {/* PARTIE GAUCHE : TITRE + INFO */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-800 dark:text-white uppercase text-[0.95rem] leading-tight mb-0.5 truncate">
                        {song.titre}
                    </h3>
                    <div className="text-[10px] uppercase font-bold truncate flex items-center gap-1">
                        {/* Artiste en GRIS (au lieu d'orange) */}
                        <span className="text-gray-500 dark:text-gray-400">{song.artiste || "Inconnu"}</span>
                        
                        {song.categorie && (
                            <>
                                <span className="text-gray-300">•</span>
                                <span className="text-gray-400 dark:text-gray-500 font-medium">{song.categorie}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* PARTIE DROITE : CLÉ (KEY) */}
                {song.cle && (
                    <div className="flex flex-col items-end justify-center self-center pl-2">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">
                            {song.cle}
                        </span>
                    </div>
                )}
            </div>
        </Link>
      </motion.div>
    </div>
  );
}