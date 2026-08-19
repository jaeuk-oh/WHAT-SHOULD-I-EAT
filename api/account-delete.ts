import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard } from './_utils.js';
import { getAdminAuth, getAdminDb } from './_admin.js';

/**
 * 회원 탈퇴: 사용자의 Firestore 데이터를 모두 지우고 Auth 계정을 삭제한다.
 * 개인정보 파기 요구에 대응하기 위한 필수 기능이라 부분 실패를 조용히 넘기지 않는다.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const uid = await guard(req, res, 'accountDelete');
  if (!uid) return;

  const db = getAdminDb();
  const auth = getAdminAuth();
  if (!db || !auth) {
    console.error('account-delete: FIREBASE_SERVICE_ACCOUNT 미설정으로 탈퇴를 처리할 수 없습니다.');
    return res.status(503).json({ error: '탈퇴 처리를 일시적으로 할 수 없어요. 고객센터로 문의해주세요.' });
  }

  try {
    // 하위 컬렉션(ingredients, saved, likes)까지 함께 지운다
    await db.recursiveDelete(db.collection('users').doc(uid));
    await db.collection('usage').doc(uid).delete();
    // 데이터를 먼저 지운 뒤 계정을 지운다 — 순서가 반대면 토큰이 죽어 재시도가 어려워진다
    await auth.deleteUser(uid);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('account-delete 실패:', e);
    return res.status(500).json({ error: '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
}
