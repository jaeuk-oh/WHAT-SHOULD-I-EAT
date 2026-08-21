import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * 서버 전용 Firebase Admin 초기화.
 *
 * FIREBASE_SERVICE_ACCOUNT 에 서비스 계정 JSON을 그대로 넣거나 base64로 인코딩해 넣는다.
 * 설정되지 않으면 null을 반환하고, 호출부는 각자 폴백을 결정한다.
 */

let cachedApp: App | null | undefined;

function parseServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  try {
    return JSON.parse(text) as Record<string, string>;
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT 파싱 실패 — JSON 또는 base64(JSON) 형식이어야 합니다.');
    return null;
  }
}

function getAdminApp(): App | null {
  if (cachedApp !== undefined) return cachedApp;

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    cachedApp = null;
    return cachedApp;
  }

  try {
    const existing = getApps();
    cachedApp =
      existing.length > 0
        ? existing[0]
        : initializeApp({
            credential: cert({
              projectId: serviceAccount.project_id,
              clientEmail: serviceAccount.client_email,
              // 환경변수로 넘어오면서 개행이 이스케이프되는 경우가 많다
              privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n'),
            }),
          });
  } catch (e) {
    console.error('Firebase Admin 초기화 실패:', e);
    cachedApp = null;
  }
  return cachedApp;
}

export function getAdminDb(): Firestore | null {
  const app = getAdminApp();
  if (!app) return null;
  // AI Studio가 만든 프로젝트는 비기본 Firestore 데이터베이스를 쓴다
  const databaseId = process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID;
  return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}
