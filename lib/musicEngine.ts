// --- TYPES ---
export type ChordTokenType = 'chord' | 'lyrics' | 'comment' | 'header' | 'space';

export interface ChordToken {
  type: ChordTokenType;
  value: string;
  originalChord?: string;
}

export type ChordLine = ChordToken[];

// --- CONSTANTES & LOGIQUE ---
const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTES_FLAT  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const ENHARMONIC_MAP: Record<string, string> = { "E#": "F", "B#": "C", "CB": "B", "FB": "E" };

const normalizeNote = (note: string): string => note.replace(/♯/g, "#").replace(/♭/g, "b").replace(/♮/g, "").trim();

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
    if (cleanLine.startsWith('{') || cleanLine.startsWith('(')) {
       const text = cleanLine.replace(/[{}]/g, '');
       if(text.match(/soc|start_of_chorus/i)) return [{ type: 'comment', value: 'Refrain :' }];
       if(text.match(/eoc|end_of_chorus/i)) return [{ type: 'space', value: '' }];
       return [{ type: 'comment', value: text }];
    }
    if (cleanLine.startsWith('#')) return [{ type: 'header', value: cleanLine.replace(/#/g, '') }];
    if (cleanLine === '') return [{ type: 'space', value: '' }];

    const regex = /\[([^\]]+)\]([^\[]*)/g;
    let match;
    const firstBracket = cleanLine.indexOf('[');
    
    if (firstBracket > 0) tokens.push({ type: 'lyrics', value: cleanLine.substring(0, firstBracket) });
    else if (firstBracket === -1) { tokens.push({ type: 'lyrics', value: cleanLine }); return tokens; }

    while ((match = regex.exec(cleanLine)) !== null) {
      tokens.push({ type: 'chord', value: match[1], originalChord: match[1] });
      if (match[2]) tokens.push({ type: 'lyrics', value: match[2] });
    }
    return tokens;
  });
};