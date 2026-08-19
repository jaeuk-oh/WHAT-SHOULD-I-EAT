export const INGREDIENT_CATEGORIES = ['유제품', '콩류', '채소류', '육류', '과일', '기타'] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  /** "1팩", "2개", "500g" 처럼 표시용 자유 텍스트. 계산하지 않는다. */
  quantity: string;
  expiresAt: Date;
}

export interface NewIngredient {
  name: string;
  category: IngredientCategory;
  quantity: string;
  shelfLifeDays: number;
}

/** 재료가 목록에서 사라진 이유. 'eaten'과 'discarded'를 구분해야 낭비를 측정할 수 있다. */
export type ConsumeAction = 'eaten' | 'discarded';

export interface HistoryEntry {
  id: string;
  name: string;
  category: IngredientCategory;
  action: ConsumeAction;
  at: Date;
}

export interface SavingsSummary {
  eaten: number;
  discarded: number;
  /** 소진율(0~1). 이 서비스의 본질적 가치 지표. */
  rate: number;
}

export function summarize(entries: HistoryEntry[]): SavingsSummary {
  const eaten = entries.filter((e) => e.action === 'eaten').length;
  const discarded = entries.filter((e) => e.action === 'discarded').length;
  const total = eaten + discarded;
  return { eaten, discarded, rate: total === 0 ? 0 : eaten / total };
}

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export type IngredientVM = Ingredient & { daysLeft: number };

export interface RecommendedRecipe {
  title: string;
  time: string;
  difficulty: string;
  warning: string;
  warningType: 'alert' | 'info';
  tags: string[];
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
}

export type SavedRecipeInput = Omit<SavedRecipe, 'id'>;

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

export interface RecipeDetailIngredient {
  name: string;
  amount: string;
  owned: boolean;
}

export interface RecipeStep {
  text: string;
  tip: string;
}

export interface RecipeDetail {
  title: string;
  summary: string;
  time: string;
  difficulty: string;
  servings: string;
  ingredients: RecipeDetailIngredient[];
  steps: RecipeStep[];
  tips: string[];
}
