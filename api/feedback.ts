import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard } from './_utils.js';
import { getAdminDb } from './_admin.js';
import { FEEDBACK_BONUS } from './_quota.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const uid = await guard(req, res, 'feedback');
  if (!uid) return;

  const body = (req.body ?? {}) as { message?: unknown; path?: unknown };
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
  const path = typeof body.path === 'string' ? body.path.slice(0, 200) : '';

  if (message.length < 5) {
    return res.status(400).json({ error: '조금 더 자세히 알려주시겠어요? (5자 이상)' });
  }

  const db = getAdminDb();
  if (!db) {
    console.error('[feedback] FIREBASE_SERVICE_ACCOUNT 미설정 — 피드백을 저장할 수 없습니다.');
    return res.status(503).json({ error: '지금은 피드백을 받을 수 없어요. 잠시 후 다시 시도해주세요.' });
  }

  try {
    await db.collection('feedback').add({
      uid,
      message,
      path,
      createdAt: new Date(),
    });

    // 처음 남기는 피드백에만 "이용권"(일일 한도 보너스)을 준다. users/{uid}.feedbackRewardGranted로 1회만 지급을 보장한다.
    const userRef = db.collection('users').doc(uid);
    const bonusGranted = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (snap.exists && snap.data()?.feedbackRewardGranted === true) return false;
      tx.set(userRef, { feedbackRewardGranted: true, updatedAt: new Date() }, { merge: true });
      tx.set(db.collection('usage').doc(uid), { bonus: FEEDBACK_BONUS }, { merge: true });
      return true;
    });

    return res.status(200).json({ ok: true, bonusGranted });
  } catch (e) {
    console.error('feedback 저장 실패:', e);
    return res.status(502).json({ error: '피드백 전송에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
}
