import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard } from './_utils.js';
import { recommendRecipes, type RecommendInput } from './_core.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const uid = await guard(req, res, 'recommend');
  if (!uid) return;

  const body = (req.body ?? {}) as Partial<RecommendInput>;
  const rawIngredients = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (rawIngredients.length > 100) {
    return res.status(400).json({ error: '재료가 너무 많습니다.' });
  }

  const input: RecommendInput = {
    // 재료가 없어도 거절하지 않는다 — 기본 메뉴를 추천한다
    ingredients: rawIngredients.slice(0, 100).map((i) => ({
      name: String(i.name ?? '').slice(0, 50),
      category: String(i.category ?? '기타').slice(0, 10),
      daysLeft: Math.max(0, Math.min(999, Number(i.daysLeft) || 0)),
    })),
    prompt: typeof body.prompt === 'string' ? body.prompt.slice(0, 200) : undefined,
    category: typeof body.category === 'string' ? body.category.slice(0, 20) : undefined,
    exclude: Array.isArray(body.exclude) ? body.exclude.slice(0, 20).map((t) => String(t).slice(0, 60)) : undefined,
  };

  try {
    const recipes = await recommendRecipes(input);
    return res.status(200).json({ recipes });
  } catch (e) {
    console.error('recommend 실패:', e);
    return res.status(502).json({ error: '레시피 추천에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
}
