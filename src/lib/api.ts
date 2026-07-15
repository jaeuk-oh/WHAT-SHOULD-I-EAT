import { auth } from './firebase';
import type { NewIngredient, RecommendedRecipe } from '../types';

async function authedPost<T>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `요청에 실패했어요 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function scanReceipt(imageDataUrl: string): Promise<NewIngredient[]> {
  const data = await authedPost<{ items: NewIngredient[] }>('/api/receipt-scan', { image: imageDataUrl });
  return data.items;
}

export interface RecommendRequest {
  ingredients: { name: string; category: string; daysLeft: number }[];
  prompt?: string;
  category?: string;
  exclude?: string[];
}

export async function fetchRecommendations(request: RecommendRequest): Promise<RecommendedRecipe[]> {
  const data = await authedPost<{ recipes: RecommendedRecipe[] }>('/api/recommend', request);
  return data.recipes;
}
