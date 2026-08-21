/**
 * 공유 레시피(recipes) 시드 스크립트.
 *
 * 보안 규칙상 클라이언트는 recipes를 생성할 수 없다. 초기 데이터는 이 스크립트로 넣는다.
 *   npx tsx scripts/seed-recipes.ts
 *
 * 필요 환경변수: FIREBASE_SERVICE_ACCOUNT, (선택) FIRESTORE_DATABASE_ID
 *
 * 주의: 실존 인물의 이름을 저작자로 표기하지 않는다. 실제 인물의 레시피를 싣고 싶다면
 * 반드시 사전 협의와 서면 동의를 받고, 출처와 원문 링크를 함께 표기할 것.
 */
import 'dotenv/config';
import { getAdminDb } from '../api/_admin.js';

type SeedRecipe = {
  id: string;
  title: string;
  author: string;
  type: 'community' | 'celeb';
  tags: string[];
  likes: number;
};

const SEED: SeedRecipe[] = [
  { id: 'community-tuna-mayo', title: '자취생 10분컷 참치마요 덮밥', author: '한끼조교', type: 'community', likes: 0, tags: ['자취', '초간단'] },
  { id: 'community-oatmeal', title: '식단러의 눈물젖은 오트밀죽', author: '오늘도식단', type: 'community', likes: 0, tags: ['다이어트', '오트밀'] },
  { id: 'community-braised-pork', title: '주말에 만드는 돼지갈비찜', author: '집밥연구소', type: 'community', likes: 0, tags: ['돼지고기', '전통'] },
  { id: 'community-chicken-rice', title: '남은 치킨 200% 활용 볶음밥', author: '냉장고털이범', type: 'community', likes: 0, tags: ['활용', '치킨'] },
  { id: 'celeb-jjajang', title: '집에서 만드는 옛날 짜장면', author: '면식당 김주방장', type: 'celeb', likes: 0, tags: ['면요리', '중식'] },
  { id: 'celeb-onion', title: '만능 양파볶음 베이스', author: '동네반찬 이여사', type: 'celeb', likes: 0, tags: ['만능', '밑반찬'] },
  { id: 'celeb-tendon', title: '바삭한 튀김덮밥 텐동', author: '튀김집 박셰프', type: 'celeb', likes: 0, tags: ['튀김', '일식'] },
];

async function main() {
  const db = getAdminDb();
  if (!db) {
    console.error('FIREBASE_SERVICE_ACCOUNT 가 설정되지 않았습니다. .env 에 서비스 계정 JSON을 넣어주세요.');
    process.exit(1);
  }

  const batch = db.batch();
  for (const { id, ...data } of SEED) {
    const ref = db.collection('recipes').doc(id);
    const snap = await ref.get();
    // 문서 ID를 고정해 여러 번 실행해도 중복이 생기지 않는다.
    // 이미 있으면 likes(사용자가 누른 값)는 보존하고 나머지 필드만 갱신한다.
    batch.set(ref, snap.exists ? data : { ...data, createdAt: new Date() }, { merge: true });
    if (snap.exists) batch.update(ref, { likes: snap.data()?.likes ?? 0 });
  }
  await batch.commit();
  console.log(`레시피 ${SEED.length}건 시드 완료`);
}

main().catch((e) => {
  console.error('시드 실패:', e);
  process.exit(1);
});
