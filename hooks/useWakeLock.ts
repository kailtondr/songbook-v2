'use client';
import { useEffect } from 'react';

export const useWakeLock = () => {
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      // Vérifie si la fonctionnalité existe sur ce navigateur
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('💡 Écran maintenu allumé');
        } catch (err) {
          console.error(`Impossible de verrouiller l'écran:`, err);
        }
      }
    };

    // Active le verrou au chargement
    requestWakeLock();

    // Si l'utilisateur quitte l'app et revient, on réactive
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) wakeLock.release();
    };
  }, []);
};