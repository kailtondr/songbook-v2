// --- TYPES ---
export type ChordTokenType = 'chord' | 'lyrics' | 'comment' | 'header' | 'space' | 'chorus_start' | 'chorus_end';

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

const normalizeNote = (note: string): string => {
  return note.replace(/♯/g, "#").replace(/♭/g, "b").replace(/♮/g, "").trim();
};

const getNoteIndex = (note: string): number => {
  const n = normalizeNote(note).toUpperCase();
  let idx = NOTES_SHARP.indexOf(n);
  if (idx !== -1) return idx;
  idx = NOTES_FLAT.indexOf(n);
  if (idx !== -1) return idx;
  if (ENHARMONIC_MAP[n]) return NOTES_SHARP.indexOf(ENHARMONIC_MAP[n]);
  return -1;
};

const transformNote = (note: string, semitones: number, useFlats: boolean): string => {
  const index = getNoteIndex(note);
  if (index === -1) return note;
  const newIndex = (index + semitones + 120) % 12;
  return useFlats ? NOTES_FLAT[newIndex] : NOTES_SHARP[newIndex];
};

// --- API EXPORTÉE ---

export const transposeChord = (chord: string, semitones: number, preferFlat: boolean): string => {
  if (semitones === 0) return chord;
  if (chord.includes('/')) {
    const parts = chord.split('/');
    if (parts.length === 2) {
      return `${transposeChord(parts[0], semitones, preferFlat)}/${transposeChord(parts[1], semitones, preferFlat)}`;
    }
  }
  const match = normalizeNote(chord).match(/^([A-G][#b]?)(.*)$/i);
  if (!match) return chord;
  const root = match[1];
  const extension = match[2];
  return transformNote(root, semitones, preferFlat) + extension;
};

export const parseChordPro = (content: string): ChordLine[] => {
  if (!content) return [];

  return content.split('\n').map((line) => {
    const cleanLine = line.trim();
    const tokens: ChordToken[] = [];

    // 1. Détection des blocs spéciaux (Refrain)
    if (cleanLine.match(/^\{(soc|start_of_chorus)\}/i)) {
        return [{ type: 'chorus_start', value: '' }];
    }
    if (cleanLine.match(/^\{(eoc|end_of_chorus)\}/i)) {
        return [{ type: 'chorus_end', value: '' }];
    }

    // 2. Commentaires et Headers
    if (cleanLine.startsWith('{') || cleanLine.startsWith('(')) {
       const text = cleanLine.replace(/[{}]/g, '');
       return [{ type: 'comment', value: text }];
    }
    
    if (cleanLine.startsWith('#')) {
        return [{ type: 'header', value: cleanLine.replace(/#/g, '') }];
    }

    if (cleanLine === '') {
        return [{ type: 'space', value: '' }];
    }

    // 3. Parsing des accords [Am]
    const regex = /\[([^\]]+)\]([^\[]*)/g;
    let match;

    const firstBracket = cleanLine.indexOf('[');
    if (firstBracket > 0) {
       tokens.push({ type: 'lyrics', value: cleanLine.substring(0, firstBracket) });
    } else if (firstBracket === -1) {
       tokens.push({ type: 'lyrics', value: cleanLine });
       return tokens;
    }

    while ((match = regex.exec(cleanLine)) !== null) {
      tokens.push({ type: 'chord', value: match[1], originalChord: match[1] });
      
      const suffix = match[2]; // Ce qui suit l'accord

      // --- CORRECTION FORCÉE V2 ---
      // On regarde si le suffixe contient autre chose que des espaces vides
      if (suffix && suffix.trim().length > 0) {
        // C'est des vraies paroles
        tokens.push({ type: 'lyrics', value: suffix });
      } else {
        // C'est vide (ex: [C][G]) ou juste un espace (ex: [C] [G])
        // On FORCE l'insertion de 3 espaces insécables (Unicode \u00A0)
        // Cela garantit un écart visible à l'écran quoi qu'il arrive.
        tokens.push({ type: 'lyrics', value: '\u00A0\u00A0\u00A0' }); 
      }
    }

    return tokens;
  });
};

export const guessPreferFlats = (key: string): boolean => {
    const flatKeys = ['F', 'Dm', 'Bb', 'Gm', 'Eb', 'Cm', 'Ab', 'Fm', 'Db', 'Bbm', 'Gb', 'Ebm'];
    return flatKeys.includes(key.trim());
};

// --- NOUVELLE FONCTION : NETTOYAGE REFRAINS ---
export const cleanupChorusTags = (text: string): string => {
  if (!text) return "";

  // 1. Vérifier si des balises existent déjà
  const hasExistingTags = /\{(soc|start_of_chorus|eoc|end_of_chorus)\}/i.test(text);

  if (hasExistingTags) {
    // Si oui, on supprime juste les étoiles en début de ligne
    return text.replace(/^\s*\*\s?/gm, '');
  }

  // 2. Sinon, on traite ligne par ligne
  const lines = text.split('\n');
  let result: string[] = [];
  let inChorus = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Détection de l'étoile (avec ou sans espace avant/après)
    const isStarLine = /^\s*\*/.test(line);

    if (isStarLine) {
      // Si on entre dans un bloc étoilé
      if (!inChorus) {
        result.push('{soc}'); // Start of Chorus
        inChorus = true;
      }
      // On nettoie la ligne (enlève l'étoile)
      result.push(line.replace(/^\s*\*\s?/, ''));
    } else {
      // Si on sort d'un bloc étoilé
      if (inChorus) {
        result.push('{eoc}'); // End of Chorus
        inChorus = false;
      }
      result.push(line);
    }
  }
  
  // Fermer la balise si le texte finit par un refrain
  if (inChorus) {
    result.push('{eoc}');
  }

  return result.join('\n');
};