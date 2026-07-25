import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// 매일 실행되는 크론: 알림을 켠 유저에게 임박(D-1 이하) 재료를 이메일로 알린다.
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

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY 미설정');
  const from = process.env.DIGEST_FROM_EMAIL || '냉털메이트 <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    console.error('이메일 발송 실패:', to, res.status, await res.text().catch(() => ''));
    return false;
  }
  return true;
}

function buildHtml(displayName: string | undefined, items: { name: string; daysLeft: number }[]): string {
  const rows = items
    .map(
      (i) =>
        `<li style="margin:4px 0"><b>${i.name}</b> — ${i.daysLeft === 0 ? '<span style="color:#b3261e">오늘까지</span>' : 'D-' + i.daysLeft}</li>`,
    )
    .join('');
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1f6d3a">🧊 ${displayName ? displayName + '님, ' : ''}곧 상하는 재료가 있어요</h2>
      <p>냉장고에서 아래 재료를 먼저 써보세요. 앱을 열면 이 재료로 만들 수 있는 레시피를 추천해드려요.</p>
      <ul style="padding-left:18px">${rows}</ul>
      <p style="color:#888;font-size:12px;margin-top:24px">알림을 그만 받으려면 앱 메뉴에서 '임박 재료 알림'을 꺼주세요.</p>
    </div>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더로 호출한다
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: '허용되지 않은 호출입니다.' });
  }

  try {
    const databaseId = process.env.VITE_FIREBASE_DATABASE_ID;
    const db = databaseId ? getFirestore(adminApp(), databaseId) : getFirestore(adminApp());

    const usersSnap = await db.collection('users').where('notifyExpiry', '==', true).get();
    let notified = 0;
    let skipped = 0;

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      const email = data.email as string | undefined;
      if (!email) {
        skipped += 1;
        continue;
      }
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

      const subject = `🧊 곧 상하는 재료 ${urgent.length}개가 있어요`;
      const ok = await sendEmail(email, subject, buildHtml(data.displayName as string | undefined, urgent));
      if (ok) notified += 1;
    }

    return res.status(200).json({ ok: true, notified, skipped, scanned: usersSnap.size });
  } catch (e) {
    console.error('expiry-digest 실패:', e);
    return res.status(500).json({ error: '알림 처리에 실패했습니다.' });
  }
}
