import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

// 매일 실행되는 크론: 알림을 켠 유저의 재고에서 임박(D-1 이하) 재료를 찾아
// 인앱 알림함(users/{uid}/notifications)에 쌓는다. 벨 아이콘 뱃지가 이걸 구독한다.
// Vercel Cron이 호출하며, CRON_SECRET 헤더로 외부 호출을 차단한다.

let cachedApp: App | null = null;

function adminApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0];
    return cachedApp;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT 미설정');
  const serviceAccount = JSON.parse(raw);
  cachedApp = initializeApp({ credential: cert(serviceAccount) });
  return cachedApp;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysLeft(expiresAt: Date): number {
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  return Math.max(0, Math.round((startOfDay(expiresAt).getTime() - startOfDay(new Date()).getTime()) / MS_PER_DAY));
}

function buildBody(items: { name: string; daysLeft: number }[]): string {
  const names = items
    .slice(0, 3)
    .map((i) => (i.daysLeft === 0 ? `${i.name}(오늘까지)` : `${i.name}(D-${i.daysLeft})`))
    .join(', ');
  const rest = items.length > 3 ? ` 외 ${items.length - 3}개` : '';
  return `${names}${rest} — 먼저 써보세요.`;
}

/** KST 기준 오늘 날짜 문자열. 같은 날 여러 번 돌아도 문서를 덮어써서 알림이 중복 쌓이지 않게 한다. */
function todayKstKey(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더로 호출한다.
  // 시크릿이 없으면 열어두지 않고 막는다 — 전체 사용자를 순회하는 경로라
  // 무인증으로 열리면 남용(과도한 재실행에 의한 읽기·쓰기 폭탄)의 통로가 된다.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET 미설정 — 크론 엔드포인트를 차단했다.');
    return res.status(503).json({ error: '알림 기능이 설정되지 않았습니다.' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: '허용되지 않은 호출입니다.' });
  }

  try {
    const databaseId = process.env.VITE_FIREBASE_DATABASE_ID;
    const db = databaseId ? getFirestore(adminApp(), databaseId) : getFirestore(adminApp());

    const usersSnap = await db.collection('users').where('notifyExpiry', '==', true).get();
    const dateKey = todayKstKey();
    let notified = 0;
    let skipped = 0;

    for (const userDoc of usersSnap.docs) {
      const ingSnap = await userDoc.ref.collection('ingredients').get();
      const urgent = ingSnap.docs
        .map((d) => {
          const expiresAt = d.data().expiresAt;
          const date = expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt);
          return { name: String(d.data().name ?? ''), daysLeft: daysLeft(date) };
        })
        .filter((i) => i.name && i.daysLeft <= 1)
        .sort((a, b) => a.daysLeft - b.daysLeft);

      if (urgent.length === 0) {
        skipped += 1;
        continue;
      }

      // 문서 ID를 날짜로 고정해 같은 날 재실행 시 알림이 중복 쌓이지 않고 덮어써지게 한다.
      // 이미 읽은 알림이라도 새로 갱신되면 안 읽음으로 되돌아간다 — 오늘자 정보가 바뀌었으니 맞다.
      await userDoc.ref.collection('notifications').doc(`expiry-${dateKey}`).set({
        title: `곧 상하는 재료 ${urgent.length}개가 있어요`,
        body: buildBody(urgent),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      notified += 1;
    }

    return res.status(200).json({ ok: true, notified, skipped, scanned: usersSnap.size });
  } catch (e) {
    console.error('expiry-notify 실패:', e);
    return res.status(500).json({ error: '알림 처리에 실패했습니다.' });
  }
}
