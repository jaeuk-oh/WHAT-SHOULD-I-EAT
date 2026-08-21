// 유튜브 검색 단독 테스트: tsx scripts/test-youtube.ts "<레시피 이름>"
import 'dotenv/config';
import { searchRecipeVideos } from '../api/_youtube';

const title = process.argv[2] ?? '두부 애호박 볶음';

searchRecipeVideos(`${title} 레시피`)
  .then((videos) => {
    if (videos.length === 0) {
      console.log('결과 없음 — YOUTUBE_API_KEY 설정 여부를 확인하세요.');
      return;
    }
    for (const v of videos) {
      console.log(`- ${v.title}\n  ${v.channelTitle} · ${v.duration} · 조회수 ${v.viewCount.toLocaleString()}`);
      console.log(`  https://www.youtube.com/watch?v=${v.videoId}`);
    }
  })
  .catch((e) => {
    console.error('실패:', e);
    process.exit(1);
  });
