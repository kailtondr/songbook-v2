'use server';

export async function searchYoutubeAction(artist: string, title: string) {
  try {
    const query = encodeURIComponent(`${title} ${artist}`);
    
    // On simule un navigateur pour récupérer la page de recherche YouTube
    const response = await fetch(`https://www.youtube.com/results?search_query=${query}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 3600 }
    });

    const html = await response.text();

    // On utilise une Regex pour trouver le premier pattern "videoId":"...........”
    // C'est une méthode "brute" mais qui marche sans librairie
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);

    if (match && match[1]) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }

    return null;

  } catch (e) {
    console.error("Erreur native fetch:", e);
    return null;
  }
}