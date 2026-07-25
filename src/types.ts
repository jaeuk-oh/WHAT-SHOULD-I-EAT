export const INGREDIENT_CATEGORIES = ['유제품', '콩류', '채소류', '육류', '과일', '기타'] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  expiresAt: Date;
}

export interface NewIngredient {
  name: string;
  category: IngredientCategory;
  shelfLifeDays: number;
}

export type IngredientVM = Ingredient & { daysLeft: number };

export interface RecipeIngredient {
  name: string;
  amount: string;
}

export interface RecommendedRecipe {
  title: string;
  time: string;
  difficulty: string;
  servings: string;
  warning: string;
  warningType: 'alert' | 'info';
  tags: string[];
  usedIngredients: RecipeIngredient[];
  steps: string[];
  substitutes: { missing: string; replaceWith: string }[];
}

export type RecipeSource = 'ai' | 'community' | 'celeb';

export interface SavedRecipe {
  id: string;
  title: string;
  source: RecipeSource;
  time: string;
  difficulty: string;
  author: string;
  tags: string[];
  // AI 추천 레시피는 조리법을 함께 저장해 나중에 다시 볼 수 있게 한다 (커뮤니티/셀럽은 없음)
  servings?: string;
  usedIngredients?: RecipeIngredient[];
  steps?: string[];
}

export type SavedRecipeInput = Omit<SavedRecipe, 'id'>;

// 재료가 재고에서 빠질 때 남기는 신호: 요리에 썼거나(cooked) 상해서 버렸거나(discarded)
export type ConsumptionAction = 'cooked' | 'discarded';

export interface MonthlyStats {
  cooked: number;
  discarded: number;
}

export interface CommunityRecipe {
  id: string;
  title: string;
  author: string;
  type: 'community' | 'celeb';
  tags: string[];
  likes: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysLeft(expiresAt: Date): number {
  const diff = startOfDay(expiresAt).getTime() - startOfDay(new Date()).getTime();
  return Math.max(0, Math.round(diff / MS_PER_DAY));
}

export function expiryFromDays(days: number): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() + days);
  return d;
}
