// --- TYPES ---
export type ChordTokenType = 'chord' | 'lyrics' | 'comment' | 'header' | 'space';

export interface ChordToken {
  type: ChordTokenType;
  value: string;
  originalChord?: string;
}

export type ChordLine = ChordToken[];

// --- CONSTANTES & LOGIQUE INTERNE ---
const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTES_FLAT  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const ENHARMONIC_MAP: Record<string, string> = { 
  "E#": "F", "B#": "C", "CB": "B", "FB": "E" 
};

// Nettoie la note (ex: transforme "♯" en "#")
const normalizeNote = (note: string): string => {
  return note.replace(/♯/g, "#").replace(/♭/g, "b").replace(/♮/g, "").trim();
};

// Trouve l'index d'une note (0-11)
const getNoteIndex = (note: string): number => {
  const n = normalizeNote(note).toUpperCase();
  let idx = NOTES_SHARP.indexOf(n);
  if (idx !== -1) return idx;
  
  idx = NOTES_FLAT.indexOf(n);
  if (idx !== -1) return idx;

  if (ENHARMONIC_MAP[n]) {
    return NOTES_SHARP.indexOf(ENHARMONIC_MAP[n]);
  }

  return -1;
};

// Transpose une note unique
const transformNote = (note: string, semitones: number, useFlats: boolean): string => {
  const index = getNoteIndex(note);
  if (index === -1) return note;

  const newIndex = (index + semitones + 120) % 12;
  return useFlats ? NOTES_FLAT[newIndex] : NOTES_SHARP[newIndex];
};

// --- FONCTIONS EXPORTÉES (Utilisées par l'App) ---

/**
 * Transpose un accord complet (avec gestion des slash chords ex: C/G)
 */
export const transposeChord = (chord: string, semitones: number, preferFlat: boolean): string => {
  if (semitones === 0) return chord;

  // Gestion des Slash Chords (ex: C/G)
  if (chord.includes('/')) {
    const parts = chord.split('/');
    if (parts.length === 2) {
      return `${transposeChord(parts[0], semitones, preferFlat)}/${transposeChord(parts[1], semitones, preferFlat)}`;
    }
  }

  // Séparation Racine / Extension
  const match = normalizeNote(chord).match(/^([A-G][#b]?)(.*)$/i);
  if (!match) return chord;

  const root = match[1];
  const extension = match[2];

  // Transposition
  return transformNote(root, semitones, preferFlat) + extension;
};

/**
 * Convertit le texte brut en objets utilisables
 */
export const parseChordPro = (content: string): ChordLine[] => {
  if (!content) return [];

  return content.split('\n').map((line) => {
    const cleanLine = line.trim();
    const tokens: ChordToken[] = [];

    // Méta-données
    if (cleanLine.startsWith('{') || cleanLine.startsWith('(')) {
       const text = cleanLine.replace(/[{}]/g, '');
       if(text.match(/soc|start_of_chorus/i)) return [{ type: 'comment', value: 'Refrain :' }];
       if(text.match(/eoc|end_of_chorus/i)) return [{ type: 'space', value: '' }];
       return [{ type: 'comment', value: text }];
    }
    
    // Headers (# Titre)
    if (cleanLine.startsWith('#')) {
        return [{ type: 'header', value: cleanLine.replace(/#/g, '') }];
    }

    if (cleanLine === '') {
        return [{ type: 'space', value: '' }];
    }

    // Parsing Accords [Am]
    const regex = /\[([^\]]+)\]([^\[]*)/g;
    let match;

    // Texte avant le premier accord
    const firstBracket = cleanLine.indexOf('[');
    if (firstBracket > 0) {
       tokens.push({ type: 'lyrics', value: cleanLine.substring(0, firstBracket) });
    } else if (firstBracket === -1) {
       tokens.push({ type: 'lyrics', value: cleanLine });
       return tokens;
    }

    while ((match = regex.exec(cleanLine)) !== null) {
      tokens.push({ type: 'chord', value: match[1], originalChord: match[1] });
      if (match[2]) {
        tokens.push({ type: 'lyrics', value: match[2] });
      }
    }

    return tokens;
  });
};

/**
 * Devine si on doit utiliser les bémols par défaut selon la tonalité
 * (C'est cette fonction qui manquait !)
 */
export const guessPreferFlats = (key: string): boolean => {
    // Liste des tonalités qui utilisent généralement des bémols
    const flatKeys = ['F', 'Dm', 'Bb', 'Gm', 'Eb', 'Cm', 'Ab', 'Fm', 'Db', 'Bbm', 'Gb', 'Ebm'];
    // On nettoie la clé (ex: "F " -> "F") et on vérifie
    return flatKeys.includes(key.trim());
};