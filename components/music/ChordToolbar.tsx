'use client';

interface ChordToolbarProps {
  content: string;
  onInsert: (text: string, cursorOffset?: number) => void;
  onSmartPaste?: () => void; // Optionnel, car la page Add l'utilise différemment parfois
}

export default function ChordToolbar({ onInsert, onSmartPaste }: ChordToolbarProps) {
  
  // Notes de base conservées pour la composition
  const baseNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  // Suffixes courants
  const suffixes = ['m', '7', 'sus', 'add', 'maj7'];

  return (
    <div className="w-full bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-2 overflow-x-auto no-scrollbar">
      <div className="flex gap-2 min-w-max items-center">
        
        {/* --- 1. STRUCTURE (PRIORITAIRE) --- */}
        <div className="flex gap-1 pr-2 border-r border-gray-200 dark:border-slate-700">
            <button
              onClick={() => onInsert('{soc}\n', 0)}
              className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-lg hover:bg-blue-200 transition-colors"
              title="Début de Refrain (Start of Chorus)"
            >
              Refrain
            </button>
            <button
              onClick={() => onInsert('{eoc}\n', 0)}
              className="px-3 py-2 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-lg hover:bg-blue-100 transition-colors"
              title="Fin de Refrain (End of Chorus)"
            >
              Fin
            </button>
            <button
              onClick={() => onInsert('{c: }', 1)} // Le 1 place le curseur entre les accolades
              className="px-3 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-lg hover:bg-gray-200 transition-colors"
              title="Commentaire (Intro, Couplet...)"
            >
              Comm.
            </button>
        </div>

        {/* --- 2. CROCHETS SÉPARÉS --- */}
        <div className="flex gap-1 pr-2 border-r border-gray-200 dark:border-slate-700">
            <button
              onClick={() => onInsert('[', 0)}
              className="w-10 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold text-sm rounded-lg hover:bg-orange-200 transition-colors"
            >
              [
            </button>
            <button
              onClick={() => onInsert(']', 0)}
              className="w-10 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold text-sm rounded-lg hover:bg-orange-200 transition-colors"
            >
              ]
            </button>
        </div>

        {/* --- 3. SMART PASTE (Si disponible) --- */}
        {onSmartPaste && (
            <div className="flex gap-1 pr-2 border-r border-gray-200 dark:border-slate-700">
                <button
                  onClick={onSmartPaste}
                  className="px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold text-xs rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1"
                  title="Coller depuis le presse-papier (intelligent)"
                >
                  📋 Coller
                </button>
            </div>
        )}

        {/* --- 4. NOTES DE BASE --- */}
        <div className="flex gap-1">
            {baseNotes.map((note) => (
              <button
                key={note}
                onClick={() => onInsert(note, 0)}
                className="w-8 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                {note}
              </button>
            ))}
        </div>

        {/* --- 5. SUFFIXES --- */}
        <div className="flex gap-1 pl-2 border-l border-gray-200 dark:border-slate-700">
            {suffixes.map((sf) => (
              <button
                key={sf}
                onClick={() => onInsert(sf, 0)}
                className="px-2 py-2 text-gray-500 dark:text-gray-400 font-medium text-xs hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                {sf}
              </button>
            ))}
        </div>

      </div>
    </div>
  );
}