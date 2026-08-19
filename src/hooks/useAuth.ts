import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
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

/**
 * 카카오톡·인스타그램 등 인앱 브라우저에서는 팝업이 차단돼 로그인이 아예 안 된다.
 * 한국 사용자의 주요 유입 경로라서 이 경우는 리다이렉트 방식으로 우회한다.
 */
function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|DaumApps|everytimeApp/i.test(ua);
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 리다이렉트 로그인으로 돌아온 경우의 실패를 여기서 잡는다
    getRedirectResult(auth).catch((e) => {
      console.error('리다이렉트 로그인 실패:', e);
      setError('로그인에 실패했어요. 다시 시도해주세요.');
    });

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
    const provider = new GoogleAuthProvider();

    if (isInAppBrowser()) {
      await signInWithRedirect(auth, provider);
      return;
    }

    try {
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      // 팝업이 막힌 환경이면 리다이렉트로 한 번 더 시도한다
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
        return;
      }
      console.error('로그인 실패:', e);
      setError('로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return { user, loading, error, login, logout };
}
