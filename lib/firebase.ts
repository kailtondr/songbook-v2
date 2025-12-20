import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Vos identifiants (récupérés de votre index.html)
const firebaseConfig = {
  apiKey: "AIzaSyAt3kfpJY2TJiXy1iv7oQoLfaIcWixbLeI",
  authDomain: "songbook-app-78e6c.firebaseapp.com",
  projectId: "songbook-app-78e6c",
  storageBucket: "songbook-app-78e6c.firebasestorage.app",
  messagingSenderId: "937728685478",
  appId: "1:937728685478:web:9f8f7f68252cb387644b67"
};

// Initialisation "Singleton" (pour éviter de réinitialiser à chaque rechargement)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);