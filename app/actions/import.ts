'use server';

// Types de retour
type ImportedSong = {
  titre: string;
  artiste: string;
  contenu: string; // Format ChordPro complet (soc, eoc, inline, comments)
  source: string;
  url: string;
};

export async function importSongFromUrlAction(url: string): Promise<ImportedSong | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    const html = await response.text();

    if (url.includes('ultimate-guitar.com')) {
      return parseUltimateGuitar(html, url);
    }
    
    if (url.includes('cifras.com.br')) {
      return parseCifrasClub(html, url);
    }

    throw new Error("Site non supporté. Utilisez Ultimate Guitar ou Cifras Club.");

  } catch (error) {
    console.error("Erreur import:", error);
    return null;
  }
}

// ==========================================
// PARSERS SPÉCIFIQUES
// ==========================================

function parseUltimateGuitar(html: string, url: string): ImportedSong {
  const regexStore = /class="js-store"[^>]*data-content="([^"]*)"/;
  const match = html.match(regexStore);

  if (!match || !match[1]) throw new Error("Données Ultimate Guitar introuvables.");

  const jsonRaw = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  let data;
  try { data = JSON.parse(jsonRaw); } catch (e) { throw new Error("Erreur parsing JSON UG"); }

  const tabData = data?.store?.page?.data?.tab;
  const tabContent = data?.store?.page?.data?.tab_view?.wiki_tab?.content;

  if (!tabData || !tabContent) throw new Error("Contenu partition introuvable.");

  // PIPELINE DE TRAITEMENT
  let content = tabContent;
  content = decodeHtmlEntities(content);                // 1. Nettoyage caractères (&eacute; -> é)
  content = content.replace(/\[ch\](.*?)\[\/ch\]/g, '$1'); // 2. Nettoyage balises UG
  content = content.replace(/\[\/?tab\]/g, ''); 
  content = content.replace(/\r\n/g, '\n');
  content = removeTablatureLines(content);              // 3. Suppression tabs
  content = mergeChordsWithLyrics(content);             // 4. Conversion Inline [Am]
  content = formatChordProStructure(content);           // 5. Structure {soc}, {c:...}

  return {
    titre: decodeHtmlEntities(tabData.song_name),
    artiste: decodeHtmlEntities(tabData.artist_name),
    contenu: content,
    source: 'Ultimate Guitar',
    url: url
  };
}

function parseCifrasClub(html: string, url: string): ImportedSong {
  const regexJson = /<script id="js-initial-data" type="application\/json">(.*?)<\/script>/;
  const match = html.match(regexJson);

  if (match && match[1]) {
      const data = JSON.parse(match[1]);
      let lyrics = data.song.cifra || ""; 
      
      lyrics = decodeHtmlEntities(lyrics);
      let content = lyrics.replace(/<b>(.*?)<\/b>/g, '[$1]'); 
      content = content.replace(/<\/?[^>]+(>|$)/g, "");
      
      content = removeTablatureLines(content);
      content = mergeChordsWithLyrics(content);
      content = formatChordProStructure(content); // Application de la structure intelligente

      return {
          titre: decodeHtmlEntities(data.song.name),
          artiste: decodeHtmlEntities(data.song.artist.name),
          contenu: content,
          source: 'Cifras Club',
          url: url
      };
  }
  throw new Error("Structure Cifras Club non reconnue");
}


// ==========================================
// MOTEUR INTELLIGENT (PROCESSING)
// ==========================================

// 1. DÉCODEUR HTML (Pour gérer Pr&eacute;-refrain)
function decodeHtmlEntities(str: string): string {
    if (!str) return "";
    return str
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&eacute;/g, 'é').replace(/&Eacute;/g, 'É')
        .replace(/&egrave;/g, 'è').replace(/&Egrave;/g, 'È')
        .replace(/&ecirc;/g, 'ê').replace(/&Ecirc;/g, 'Ê')
        .replace(/&agrave;/g, 'à').replace(/&Agrave;/g, 'À')
        .replace(/&ccedil;/g, 'ç').replace(/&Ccedil;/g, 'Ç')
        .replace(/&ocirc;/g, 'ô').replace(/&Ocirc;/g, 'Ô')
        .replace(/&icirc;/g, 'î').replace(/&Icirc;/g, 'Î')
        .replace(/&iuml;/g, 'ï')
        .replace(/&ucirc;/g, 'û')
        .replace(/&oelig;/g, 'œ')
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
}

// 2. SUPPRESSION TABLATURES
function removeTablatureLines(text: string): string {
    return text.split('\n').filter(line => {
        const trim = line.trim();
        const isTab = /^[eBGDAE]\|/.test(trim) || /\|-+\|/.test(trim) || (trim.match(/-/g) || []).length > 5;
        return !isTab;
    }).join('\n');
}

// 3. FUSION INLINE (Accords sur paroles)
function mergeChordsWithLyrics(text: string): string {
    const lines = text.split('\n');
    let result: string[] = [];

    const smartChordRegex = /^([A-G][b#♯♭]?)((?:m|M|maj|min|dim|aug|sus|add|°|ø|Δ|\+|-|\d|[()])*)(?:\/(?:[A-G][b#♯♭]?|[\d\+\-\(\)b#♯♭]+))?$/;
    const excludedWords = new Set(["a", "I", "Un", "Le", "La", "Les", "De", "Du", "En", "Et", "Est", "Agnus", "Avec", "Aux"]);
    const cleanToken = (t: string) => t.replace(/^[\[\](){}<>.,;*:"']+|[\[\](){}<>.,;*:"']+$/g, '');

    function isLikelyChord(token: string) {
        const clean = cleanToken(token);
        if (!clean) return false;
        if (/^\d{1,2}\/\d{1,2}$/.test(clean)) return false; 
        if (excludedWords.has(clean)) return false;
        return smartChordRegex.test(clean);
    }

    function isChordLine(line: string) {
        const cleanLine = line.trim();
        if (!cleanLine) return false;
        if (cleanLine.startsWith('{')) return false; 
        const tokens = cleanLine.split(/\s+/);
        let chordCount = 0;
        let invalidCount = 0;
        tokens.forEach(token => {
            const stripped = cleanToken(token);
            if (!stripped) return; 
            // On ignore les headers dans la détection d'accords pour ne pas les merger par erreur
            if (/^(\[|\()?(intr|intro|final|pont|bridge|coda|couplet|verse|chorus|refrain)/i.test(stripped)) return;
            if (/^[|%/:xX\-_]+$/.test(token)) return; 
            if (isLikelyChord(stripped)) chordCount++; else invalidCount++;
        });
        return chordCount > 0 && chordCount >= invalidCount;
    }

    for (let i = 0; i < lines.length; i++) {
        let currentLine = lines[i]; 

        if (isChordLine(currentLine)) {
            const isNextLineLyrics = (i + 1 < lines.length) && (lines[i + 1].trim() !== '') && (!isChordLine(lines[i + 1])) && (!lines[i + 1].trim().startsWith('{'));

            if (isNextLineLyrics) {
                let lyricLine = lines[i + 1];
                const tokenMatches = [...currentLine.matchAll(/\S+/g)];
                let combinedLine = lyricLine;

                for (let j = tokenMatches.length - 1; j >= 0; j--) {
                    const match = tokenMatches[j];
                    const token = match[0];
                    const index = match.index || 0; 
                    const stripped = cleanToken(token);
                    if (isLikelyChord(stripped)) {
                        let chord = `[${stripped}]`;
                        if (index >= combinedLine.length) combinedLine = combinedLine.padEnd(index, ' ') + chord;
                        else combinedLine = combinedLine.slice(0, index) + chord + combinedLine.slice(index);
                    }
                }
                result.push(combinedLine.trimRight());
                i++; 
            } else {
                // Ligne d'accords seule (Instrumental)
                const processed = currentLine.replace(/\S+/g, (t) => {
                    const s = cleanToken(t);
                    return isLikelyChord(s) && !t.includes('[') ? `[${s}]` : t;
                });
                result.push(processed);
            }
        } else {
            result.push(currentLine);
        }
    }
    return result.join('\n');
}

// 4. STRUCTURE INTELLIGENTE (Detection Refrain/Couplets)
function formatChordProStructure(text: string): string {
    const lines = text.split('\n');
    let result = [];
    let inChorus = false;

    // Regex pour détecter [Header], Header:, (Header)
    const headerRegex = /^(\[|\()?(refrain|chorus|refr|couplet|verse|intro|pont|bridge|pr.-refrain|pre-chorus|instrumental|coda|final)([\s\d]*)(\]|\)|:)?$/i;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        const match = line.match(headerRegex);

        if (match) {
            // C'est un titre de section !
            const type = match[2].toLowerCase(); // refrain, couplet, etc.
            const number = match[3] || ""; // " 1", " 2"
            
            // 1. Si on était dans un chorus, on le ferme car une nouvelle section commence
            if (inChorus) {
                result.push('{eoc}');
                inChorus = false;
            }

            // 2. Traitement selon le type
            if (type.startsWith('refrain') || type.startsWith('chorus') || type.startsWith('refr')) {
                // Début de refrain
                result.push('{soc}');
                inChorus = true;
                // On n'ajoute pas le texte "[Refrain]" car {soc} suffit pour l'affichage
            } else {
                // Autre section (Couplet, Intro...) -> Commentaire ChordPro
                // On nettoie le nom : "Couplet 1"
                const sectionName = type.charAt(0).toUpperCase() + type.slice(1) + number;
                result.push(`{c: ${sectionName}}`);
            }

        } else {
            // Ligne normale
            if (inChorus && line === '') {
                // Une ligne vide DANS un refrain signifie souvent la fin du refrain
                result.push('{eoc}');
                inChorus = false;
            }
            
            // On garde la ligne (sauf si c'est juste du vide consécutif)
            result.push(lines[i]);
        }
    }

    // Sécurité finale : si le refrain n'est pas fermé à la fin du fichier
    if (inChorus) {
        result.push('{eoc}');
    }

    return result.join('\n');
}