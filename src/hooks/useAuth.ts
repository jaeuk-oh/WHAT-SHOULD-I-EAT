import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

async function upsertUserDoc(user: User) {
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);
  await setDoc(
    ref,
    {
      email: user.email,
      displayName: user.displayName,
      updatedAt: serverTimestamp(),
      ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (nextUser) {
        upsertUserDoc(nextUser).catch((e) => console.error('사용자 문서 저장 실패:', e));
      }
    });
  }, []);

  const login = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      console.error('로그인 실패:', e);
      setError('로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return { user, loading, error, login, logout };
}
