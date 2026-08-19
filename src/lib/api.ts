import { auth } from './firebase';
import type { NewIngredient, RecipeDetail, RecommendedRecipe, YoutubeVideo } from '../types';

/** 서버가 명시적으로 내려준 사용자 대상 오류. 호출부가 재시도 안내에 쓸 수 있다. */
export class ApiError extends Error {
  status: number;
  retryAfterSec?: number;

  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

async function authedPost<T>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiError('로그인이 필요합니다.', 401);
  const token = await user.getIdToken();

  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('네트워크 연결을 확인해주세요.', 0);
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | { error?: string; retryAfterSec?: number }
      | null;
    throw new ApiError(
      data?.error ?? `요청에 실패했어요 (${res.status})`,
      res.status,
      data?.retryAfterSec,
    );
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

export async function fetchRecipeDetail(
  title: string,
  ingredients: { name: string; category: string; daysLeft: number }[],
): Promise<RecipeDetail> {
  const data = await authedPost<{ detail: RecipeDetail }>('/api/recipe-detail', { title, ingredients });
  return data.detail;
}

/**
 * 레시피 이름으로 유튜브 영상을 찾는다.
 * 부가 기능이라 실패해도 화면을 막지 않고 빈 배열로 처리한다.
 */
export async function fetchRecipeVideos(title: string): Promise<YoutubeVideo[]> {
  try {
    const data = await authedPost<{ videos: YoutubeVideo[] }>('/api/youtube-recipes', { title });
    return data.videos;
  } catch (e) {
    console.error('영상 검색 실패:', e);
    return [];
  }
}

/** 회원 탈퇴. 서버가 Firestore 데이터와 Auth 계정을 함께 지운다. */
export async function deleteAccount(): Promise<void> {
  await authedPost<{ ok: true }>('/api/account-delete', {});
}
