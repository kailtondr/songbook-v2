'use client';

import { useState, useMemo } from 'react';

// Données harmoniques (Inspiré de votre fichier chordstools.js)
const HARMONIC_FIELDS: Record<string, string[]> = {
    "C": ["C", "Dm", "Em", "F", "G", "Am", "Bdim"],
    "Cm": ["Cm", "Ddim", "Eb", "Fm", "Gm", "Ab", "Bb"],
    "D": ["D", "Em", "F#m", "G", "A", "Bm", "C#dim"],
    "Dm": ["Dm", "Edim", "F", "Gm", "Am", "Bb", "C"],
    "E": ["E", "F#m", "G#m", "A", "B", "C#m", "D#dim"],
    "Em": ["Em", "F#dim", "G", "Am", "Bm", "C", "D"],
    "F": ["F", "Gm", "Am", "Bb", "C", "Dm", "Edim"],
    "Fm": ["Fm", "Gdim", "Ab", "Bbm", "Cm", "Db", "Eb"],
    "G": ["G", "Am", "Bm", "C", "D", "Em", "F#dim"],
    "Gm": ["Gm", "Adim", "Bb", "Cm", "Dm", "Eb", "F"],
    "A": ["A", "Bm", "C#m", "D", "E", "F#m", "G#dim"],
    "Am": ["Am", "Bdim", "C", "Dm", "Em", "F", "G"],
    "B": ["B", "C#m", "D#m", "E", "F#", "G#m", "A#dim"],
    "Bm": ["Bm", "C#dim", "D", "Em", "F#m", "G", "A"]
};

const DIRECTIVES = [
    { label: 'Intro', text: '{soi}', title: 'Début Intro' },
    { label: 'Fin Intro', text: '{eoi}', title: 'Fin Intro' },
    { label: 'Refrain', text: '{soc}', title: 'Début Refrain' },
    { label: 'Fin Ref', text: '{eoc}', title: 'Fin Refrain' },
    { label: 'Couplet', text: '# Couplet 1', title: 'Titre Couplet' },
    { label: 'Com', text: '{c: }', offset: 1, title: 'Commentaire' },
];

interface Props {
    content: string; // Le texte actuel du chant (pour détecter les accords utilisés)
    onInsert: (text: string, cursorOffset?: number) => void; // Fonction d'insertion
}

export default function ChordToolbar({ content, onInsert }: Props) {
    const [selectedKey, setSelectedKey] = useState<string>('');

    // Analyse dynamique des accords déjà présents dans le texte
    const usedChords = useMemo(() => {
        const regex = /\[([^\]]+)\]/g;
        const matches = [...content.matchAll(regex)];
        const uniqueChords = new Set(matches.map(m => m[1]));
        // On trie pour l'affichage
        return Array.from(uniqueChords).sort();
    }, [content]);

    return (
        <div className="sticky top-[57px] z-20 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 shadow-sm transition-colors duration-300">
            {/* Zone Scrollable */}
            <div className="flex items-center gap-4 overflow-x-auto p-2 no-scrollbar">
                
                {/* 1. Symboles Rapides */}
                <div className="flex gap-1 shrink-0 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                    {['[', ']', '#', 'b', '/'].map(sym => (
                        <button 
                            key={sym}
                            onClick={() => onInsert(sym)}
                            className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 hover:bg-orange-50 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 rounded font-mono font-bold text-slate-700 dark:text-slate-200 text-sm shadow-sm transition-colors"
                            title={`Insérer ${sym}`}
                        >
                            {sym}
                        </button>
                    ))}
                    <button 
                        onClick={() => onInsert('[]', 1)} // 1 = recule le curseur de 1
                        className="px-2 h-8 flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded font-mono font-bold text-sm shadow-sm"
                        title="Insérer []"
                    >
                        [_]
                    </button>
                </div>

                {/* 2. Accords Déjà Utilisés (Dynamique) */}
                {usedChords.length > 0 && (
                    <div className="flex gap-1 shrink-0 p-1 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                        <span className="flex items-center px-1 text-[10px] font-bold text-blue-400 uppercase tracking-wider">Utilisés</span>
                        {usedChords.map(chord => (
                            <button
                                key={chord}
                                onClick={() => onInsert(`[${chord}]`)}
                                className="px-2 h-8 bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded font-mono text-sm text-blue-700 dark:text-blue-300 font-bold shadow-sm transition-colors"
                            >
                                {chord}
                            </button>
                        ))}
                    </div>
                )}

                {/* 3. Champs Harmoniques (Le Cerveau Musical) */}
                <div className="flex gap-2 shrink-0 p-1 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
                    <select 
                        className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-xs rounded px-2 py-1 outline-none focus:border-orange-500 text-slate-700 dark:text-white font-bold h-8"
                        value={selectedKey}
                        onChange={(e) => setSelectedKey(e.target.value)}
                    >
                        <option value="">Gamme...</option>
                        {Object.keys(HARMONIC_FIELDS).sort().map(k => <option key={k} value={k}>{k}</option>)}
                    </select>

                    {selectedKey && HARMONIC_FIELDS[selectedKey] && (
                        <div className="flex gap-1">
                            {HARMONIC_FIELDS[selectedKey].map(chord => (
                                <button
                                    key={chord}
                                    onClick={() => onInsert(`[${chord}]`)}
                                    className="px-2 h-8 bg-white dark:bg-slate-700 hover:bg-orange-50 dark:hover:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded font-mono text-sm text-slate-700 dark:text-slate-200 font-bold shadow-sm transition-colors"
                                >
                                    {chord}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 4. Directives (Structure) */}
                <div className="flex gap-1 shrink-0">
                    {DIRECTIVES.map(dir => (
                        <button
                            key={dir.label}
                            onClick={() => onInsert(dir.text, dir.offset || 0)}
                            className="px-2 h-8 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded text-xs font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap"
                            title={dir.title}
                        >
                            {dir.label}
                        </button>
                    ))}
                </div>

            </div>
        </div>
    );
}