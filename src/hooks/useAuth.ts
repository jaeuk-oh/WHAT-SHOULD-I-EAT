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
import { auth, db, track } from '../lib/firebase';

/**
 * Firebase Auth 오류 코드를 사용자에게 보여줄 메시지로 바꾼다.
 * auth/unauthorized-domain은 재시도로 해결되지 않는다 — 지금 접속한 도메인이
 * Firebase 콘솔 > Authentication > Settings > 승인된 도메인 목록에 없다는 뜻이라,
 * 일반 메시지("다시 시도해주세요")를 보여주면 사용자가 로그인을 계속 반복하게 된다.
 */
function describeAuthError(e: unknown): string {
  const code = (e as { code?: string }).code;
  if (code === 'auth/unauthorized-domain') {
    console.error(`로그인 실패: 승인되지 않은 도메인(${window.location.hostname})`, e);
    return '지금 접속한 주소는 아직 로그인이 승인되지 않았어요. 다시 시도해도 안 될 수 있으니 운영자에게 알려주세요.';
  }
  console.error('로그인 실패:', e);
  return '로그인에 실패했어요. 잠시 후 다시 시도해주세요.';
}

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
      setError(describeAuthError(e));
    });

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (nextUser) {
        track('login_success');
        upsertUserDoc(nextUser).catch((e) => console.error('사용자 문서 저장 실패:', e));
      }
    });
  }, []);

  const login = async () => {
    setError(null);
    track('login_click');
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
      // 팝업이 막힌 환경이면 리다이렉트로 한 번 더 시도한다 (단, 승인 안 된 도메인은 리다이렉트도 똑같이 막히므로 제외)
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
        return;
      }
      setError(describeAuthError(e));
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return { user, loading, error, login, logout };
}
