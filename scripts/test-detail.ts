// 조리법 생성 코어 로직 단독 테스트: tsx scripts/test-detail.ts "<레시피 이름>"
import 'dotenv/config';
import { getRecipeDetail } from '../api/_core';

const title = process.argv[2] ?? '두부 애호박 볶음';

getRecipeDetail({
  title,
  ingredients: [
    { name: '두부', category: '콩류', daysLeft: 1 },
    { name: '애호박', category: '채소류', daysLeft: 2 },
    { name: '계란', category: '기타', daysLeft: 12 },
  ],
})
  .then((detail) => {
    console.log(JSON.stringify(detail, null, 2));
  })
  .catch((e) => {
    console.error('실패:', e);
    process.exit(1);
  });
