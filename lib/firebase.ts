import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// Vos codes de configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAt3kfpJY2TJiXy1iv7oQoLfaIcWixbLeI",
  authDomain: "songbook-app-78e6c.firebaseapp.com",
  projectId: "songbook-app-78e6c",
  storageBucket: "songbook-app-78e6c.firebasestorage.app",
  messagingSenderId: "937728685478",
  appId: "1:937728685478:web:9f8f7f68252cb387644b67"
};

// 1. Initialiser l'App (Singleton pour éviter les doublons)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 2. Initialiser Auth
const auth = getAuth(app);

// 3. Initialiser Firestore
const db = getFirestore(app);

// 4. ACTIVER LA PERSISTANCE HORS-LIGNE
// Cela permet à l'app de fonctionner et d'afficher les chants même sans internet
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("La persistance a échoué : Plusieurs onglets ouverts.");
    } else if (err.code == 'unimplemented') {
      console.warn("Le navigateur ne supporte pas la persistance.");
    }
  });
}

export { app, db, auth };