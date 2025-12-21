'use client';

import { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const auth = getAuth(app);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/settings'); // Redirection après succès
    } catch (err) {
      setError("Email ou mot de passe incorrect.");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg w-full max-w-sm border border-gray-100 dark:border-slate-800">
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-6 text-center">Connexion</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Email</label>
            <input 
              type="email" 
              className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-500 dark:text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@songbook.com"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Mot de passe</label>
            <input 
              type="password" 
              className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-500 dark:text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}

          <button 
            type="submit" 
            className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors shadow-md"
          >
            Se connecter
          </button>
        </form>
      </div>
    </main>
  );
}