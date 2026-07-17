import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged } from '../firebase.js';
import { User } from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);
  return { user };
}
