import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported, logEvent, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
// AI Studio가 생성한 프로젝트는 비기본 Firestore 데이터베이스를 사용한다
export const db = getFirestore(app, import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)');
export const auth = getAuth(app);

/**
 * 사용자가 화면에서 뭘 먼저 누르는지 되짚어보기 위한 최소한의 이벤트 로깅.
 * VITE_FIREBASE_MEASUREMENT_ID가 없으면(Analytics 미연결) 조용히 아무 일도 하지 않는다 —
 * Firebase 콘솔 > 프로젝트 설정 > 통합 > Google Analytics 연결 후 측정 ID를 넣으면 켜진다.
 */
let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  isSupported()
    .then((ok) => {
      if (ok) analytics = getAnalytics(app);
    })
    .catch(() => {});
}

export function track(event: string, params?: Record<string, unknown>) {
  if (analytics) logEvent(analytics, event, params);
}
