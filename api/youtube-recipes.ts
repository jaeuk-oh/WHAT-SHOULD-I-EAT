import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard } from './_utils.js';
import { searchRecipeVideos } from './_youtube.js';

/**
 * 레시피 이름으로 유튜브 영상을 찾는다.
 *
 * API 키가 없거나 검색이 실패해도 200 + 빈 배열을 돌려준다.
 * 이 기능은 부가 기능이라, 실패가 조리법 화면 전체를 막으면 안 된다.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const uid = await guard(req, res, 'youtubeSearch');
  if (!uid) return;

  const body = (req.body ?? {}) as { title?: unknown };
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
  if (!title) {
    return res.status(400).json({ error: '레시피 이름이 필요합니다.' });
  }

  const videos = await searchRecipeVideos(`${title} 레시피`);
  return res.status(200).json({ videos, enabled: Boolean(process.env.YOUTUBE_API_KEY) });
}
