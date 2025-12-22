// --- TYPES ---
export type ChordTokenType = 'chord' | 'lyrics' | 'comment' | 'header' | 'space' | 'chorus_start' | 'chorus_end';

export interface ChordToken {
  type: ChordTokenType;
  value: string;
  originalChord?: string;
  isSpacer?: boolean; 
}

export type ChordLine = ChordToken[];

// --- LOGIQUE INTERNE ---
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

// --- API EXPORTÉE ---

export const transposeChord = (chord: string, semitones: number, preferFlat: boolean): string => {
  if (semitones === 0) return chord;
  if (chord.includes('/')) {
    const parts = chord.split('/');
    if (parts.length === 2) return `${transposeChord(parts[0], semitones, preferFlat)}/${transposeChord(parts[1], semitones, preferFlat)}`;
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

    // Blocs spéciaux
    if (cleanLine.match(/^\{(soc|start_of_chorus)\}/i)) return [{ type: 'chorus_start', value: '' }];
    if (cleanLine.match(/^\{(eoc|end_of_chorus)\}/i)) return [{ type: 'chorus_end', value: '' }];

    // Commentaires et Headers
    if (cleanLine.startsWith('{') || cleanLine.startsWith('(')) return [{ type: 'comment', value: cleanLine.replace(/[{}]/g, '') }];
    if (cleanLine.startsWith('#')) return [{ type: 'header', value: cleanLine.replace(/#/g, '') }];
    if (cleanLine === '') return [{ type: 'space', value: '' }];

    // Parsing
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
      const chordName = match[1];
      const suffix = match[2];
      const isSpacer = (!suffix || suffix.trim().length === 0);

      tokens.push({ type: 'chord', value: chordName, originalChord: chordName, isSpacer: isSpacer });
      
      if (suffix && suffix.length > 0) {
        tokens.push({ type: 'lyrics', value: suffix });
      } else {
        tokens.push({ type: 'lyrics', value: '\u00A0' }); 
      }
    }
    return tokens;
  });
};

export const guessPreferFlats = (key: string): boolean => {
    const flatKeys = ['F', 'Dm', 'Bb', 'Gm', 'Eb', 'Cm', 'Ab', 'Fm', 'Db', 'Bbm', 'Gb', 'Ebm'];
    return flatKeys.includes(key.trim());
};

export const cleanupChorusTags = (text: string): string => {
  if (!text) return "";
  const hasExistingTags = /\{(soc|start_of_chorus|eoc|end_of_chorus)\}/i.test(text);
  if (hasExistingTags) return text.replace(/^\s*\*\s?/gm, '');

  const lines = text.split('\n');
  let result: string[] = [];
  let inChorus = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isStarLine = /^\s*\*/.test(line);
    if (isStarLine) {
      if (!inChorus) { result.push('{soc}'); inChorus = true; }
      result.push(line.replace(/^\s*\*\s?/, ''));
    } else {
      if (inChorus) { result.push('{eoc}'); inChorus = false; }
      result.push(line);
    }
  }
  if (inChorus) result.push('{eoc}');
  return result.join('\n');
};