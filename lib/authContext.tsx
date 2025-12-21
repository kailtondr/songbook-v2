'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, getAuth } from 'firebase/auth';
import { app } from './firebase'; // Assurez-vous que l'export 'app' existe dans firebase.ts

// On initialise l'auth ici pour être sûr
const auth = getAuth(app);

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);