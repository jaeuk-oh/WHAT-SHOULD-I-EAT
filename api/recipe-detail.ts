import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard } from './_utils.js';
import { getRecipeDetail, type RecipeDetailInput } from './_core.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const uid = await guard(req, res, 'recipeDetail');
  if (!uid) return;

  const body = (req.body ?? {}) as Partial<RecipeDetailInput>;
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
  if (!title) {
    return res.status(400).json({ error: '레시피 이름이 필요합니다.' });
  }

  const ingredients = Array.isArray(body.ingredients)
    ? body.ingredients.slice(0, 100).map((i) => ({
        name: String(i.name ?? '').slice(0, 50),
        category: String(i.category ?? '기타').slice(0, 10),
        daysLeft: Math.max(0, Math.min(999, Number(i.daysLeft) || 0)),
      }))
    : [];

  try {
    const detail = await getRecipeDetail({ title, ingredients });
    return res.status(200).json({ detail });
  } catch (e) {
    console.error('recipe-detail 실패:', e);
    return res.status(502).json({ error: '조리법을 불러오지 못했어요. 잠시 후 다시 시도해주세요.' });
  }
}
