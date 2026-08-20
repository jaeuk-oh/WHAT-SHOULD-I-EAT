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
  /** 이 요리에 필요하지만 없는 재료 */
  missingIngredients: string[];
}

/** 추천 카드 정렬 기준. 사용자가 실제로 쓰는 선택 기준을 그대로 옮겼다. */
export type RecipeSort = 'recommended' | 'coverage' | 'fast' | 'easy';

export const RECIPE_SORT_LABELS: Record<RecipeSort, string> = {
  recommended: '추천순',
  coverage: '재료순',
  fast: '빠른순',
  easy: '쉬운순',
};

const DIFFICULTY_ORDER = ['아주 쉬움', '쉬움', '보통', '어려움'];

/** "15분", "1시간 20분" → 분 단위 정수. 못 읽으면 큰 값(뒤로 밀림) */
export function parseMinutes(time: string): number {
  const hour = /(\d+)\s*시간/.exec(time);
  const min = /(\d+)\s*분/.exec(time);
  const total = (hour ? Number(hour[1]) * 60 : 0) + (min ? Number(min[1]) : 0);
  return total > 0 ? total : Number.MAX_SAFE_INTEGER;
}

export function sortRecipes(recipes: RecommendedRecipe[], sort: RecipeSort): RecommendedRecipe[] {
  if (sort === 'recommended') return recipes;
  const sorted = [...recipes];
  switch (sort) {
    case 'coverage':
      // 부족한 재료가 적은 순 → 같으면 내 재료를 많이 쓰는 순
      return sorted.sort(
        (a, b) =>
          a.missingIngredients.length - b.missingIngredients.length ||
          b.usedIngredients.length - a.usedIngredients.length,
      );
    case 'fast':
      return sorted.sort((a, b) => parseMinutes(a.time) - parseMinutes(b.time));
    case 'easy':
      return sorted.sort(
        (a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty),
      );
  }
}

/**
 * 레시피 재료명과 냉장고 재료를 느슨하게 맞춘다.
 * LLM이 "애호박"이라 해도 냉장고엔 "애호박 1개"처럼 들어 있을 수 있다.
 */
export function matchesIngredient(recipeName: string, fridgeName: string): boolean {
  const a = recipeName.replace(/\s+/g, '').toLowerCase();
  const b = fridgeName.replace(/\s+/g, '').toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
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

export interface YoutubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string;
  viewCount: number;
  reason: string;
}
