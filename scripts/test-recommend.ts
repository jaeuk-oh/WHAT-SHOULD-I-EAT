// 레시피 추천 코어 로직 단독 테스트: tsx scripts/test-recommend.ts [자유 프롬프트]
import 'dotenv/config';
import { recommendRecipes } from '../api/_core';

recommendRecipes({
  ingredients: [
    { name: '두부', category: '콩류', daysLeft: 1 },
    { name: '애호박', category: '채소류', daysLeft: 2 },
    { name: '계란', category: '기타', daysLeft: 12 },
    { name: '닭가슴살', category: '육류', daysLeft: 3 },
    { name: '사과', category: '과일', daysLeft: 14 },
    { name: '청양고추', category: '채소류', daysLeft: 7 },
  ],
  prompt: process.argv[2],
})
  .then((recipes) => {
    console.log(JSON.stringify(recipes, null, 2));
  })
  .catch((e) => {
    console.error('실패:', e);
    process.exit(1);
  });
