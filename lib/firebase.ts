import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAt3kfpJY2TJiXy1iv7oQoLfaIcWixbLeI",
  authDomain: "songbook-app-78e6c.firebaseapp.com",
  projectId: "songbook-app-78e6c",
  storageBucket: "songbook-app-78e6c.firebasestorage.app",
  messagingSenderId: "937728685478",
  appId: "1:937728685478:web:9f8f7f68252cb387644b67"
};

// 1. Initialisation de l'App (Singleton)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 2. Initialisation Base de données
export const db = getFirestore(app);

// 3. Initialisation Auth
export const auth = getAuth(app);

// 4. ACTIVATION DU MODE HORS-LIGNE (Persistance)
// Ce code ne s'exécute que côté client (navigateur)
if (typeof window !== "undefined") {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code == 'failed-precondition') {
            // Cela arrive si plusieurs onglets sont ouverts en même temps
            console.warn("Mode hors-ligne désactivé (Trop d'onglets ouverts)");
        } else if (err.code == 'unimplemented') {
            console.warn("Ce navigateur ne supporte pas le stockage hors-ligne");
        }
    });
}