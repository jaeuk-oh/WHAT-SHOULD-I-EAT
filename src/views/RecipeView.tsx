import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Bookmark, ChefHat, Check, ChevronRight, Info, RefreshCw, Send, ShoppingCart, SlidersHorizontal, Wand2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useToast } from '../components/Toast';
import { fetchRecommendations } from '../lib/api';
import { subscribeRecipes } from '../lib/db';
import { recipePath } from '../lib/paths';
import {
  RECIPE_SORT_LABELS,
  sortRecipes,
  type CommunityRecipe,
  type IngredientVM,
  type RecipeSort,
  type RecommendedRecipe,
  type SavedRecipeInput,
} from '../types';

const CATEGORIES = ['전체', '다이어트', '간단한', '자극적인', '비건'];
const TABS = ['맞춤추천', '커뮤니티', '셀럽/쉐프'] as const;
type Tab = (typeof TABS)[number];

function HeartButton({ onToggle, likes, liked }: { onToggle: () => void; likes: number; liked: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center shrink-0 z-10">
      <button
        onClick={onToggle}
        aria-pressed={liked}
        aria-label={liked ? '좋아요 취소' : '좋아요'}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${liked ? 'bg-error/10 text-error' : 'bg-surface-container-low text-outline hover:text-error'}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
      <span className="text-xs font-bold text-on-surface-variant mt-1">{likes.toLocaleString()}</span>
    </div>
  );
}

/**
 * 이 추천이 왜 나왔는지 한 줄로 보여준다.
 * 사용자는 "정렬이 좋아졌다"를 못 느끼지만, "왜 이게 위에 있는지"는 바로 느낀다.
 */
function CoverageBadge({ recipe }: { recipe: RecommendedRecipe }) {
  const used = recipe.usedIngredients.length;
  const missing = recipe.missingIngredients;

  if (missing.length === 0) {
    return (
      <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
        <Check size={15} className="shrink-0" />
        지금 바로 만들 수 있어요{used > 0 && ` · 내 재료 ${used}개 사용`}
      </p>
    );
  }

  return (
    <p className="text-sm text-on-surface-variant flex items-start gap-1.5">
      <ShoppingCart size={15} className="shrink-0 mt-0.5 text-tertiary" />
      <span>
        {used > 0 && <><b className="text-on-surface">내 재료 {used}개</b> 사용 · </>}
        <b className="text-tertiary">{missing.slice(0, 3).join(', ')}</b>
        {missing.length > 3 ? ` 외 ${missing.length - 3}개` : ''}만 있으면 돼요
      </span>
    </p>
  );
}

export default function RecipeView({
  ingredients,
  savedTitles,
  likedIds,
  onToggleSave,
  onToggleLike,
}: {
  ingredients: IngredientVM[];
  savedTitles: Set<string>;
  likedIds: Set<string>;
  onToggleSave: (recipe: SavedRecipeInput, e: React.MouseEvent) => void;
  onToggleLike: (recipeId: string) => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as Tab | null;
  const currentTab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : '맞춤추천';

  const [activeCategory, setActiveCategory] = useState('전체');
  const [aiPrompt, setAiPrompt] = useState('');
  const [recipes, setRecipes] = useState<RecommendedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState<CommunityRecipe[] | null>(null);
  const [sort, setSort] = useState<RecipeSort>('recommended');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const urgent = ingredients.filter((i) => i.daysLeft <= 2);

  const visibleRecipes = sortRecipes(
    onlyAvailable ? recipes.filter((r) => r.missingIngredients.length === 0) : recipes,
    sort,
  );
  const hiddenByFilter = recipes.length - visibleRecipes.length;
  const communityList = (shared ?? []).filter((r) => r.type === 'community');
  const celebList = (shared ?? []).filter((r) => r.type === 'celeb');

  const loadRecipes = useCallback(
    async (opts?: { exclude?: string[]; category?: string; prompt?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const category = opts?.category ?? activeCategory;
        const result = await fetchRecommendations({
          ingredients: ingredients.map((i) => ({ name: i.name, category: i.category, daysLeft: i.daysLeft })),
          category: category === '전체' ? undefined : category,
          prompt: (opts?.prompt ?? aiPrompt).trim() || undefined,
          exclude: opts?.exclude,
        });
        setRecipes(result);
      } catch (e) {
        console.error('레시피 추천 실패:', e);
        setError(e instanceof Error ? e.message : '추천을 불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
    },
    // ingredients는 매 렌더 새 배열이라 의존성에 넣으면 무한 호출이 된다. 최초 1회 + 사용자 조작으로만 호출한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeCategory, aiPrompt],
  );

  useEffect(() => {
    void loadRecipes();
    return subscribeRecipes(setShared, (e) => console.error('레시피 목록 구독 실패:', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTab = (tab: Tab) => setSearchParams(tab === '맞춤추천' ? {} : { tab }, { replace: true });

  const handleCategory = (cat: string) => {
    setActiveCategory(cat);
    void loadRecipes({ category: cat });
  };

  const openDetail = (title: string) => navigate(recipePath(title));

  const sharedEmptyState = (label: string) => (
    <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant gap-2">
      {shared === null ? (
        <p className="text-sm">불러오는 중...</p>
      ) : (
        <>
          <p className="text-sm">아직 등록된 {label} 레시피가 없어요.</p>
          <p className="text-xs text-outline">곧 채워둘게요. 그동안 맞춤추천을 이용해보세요.</p>
        </>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <div className="w-full max-w-md mx-auto bg-surface min-h-screen relative">
        <AppHeader title="오늘 뭐 먹지?" />

        <div className="flex px-5 pt-2 pb-0 border-b border-surface-variant sticky top-[72px] bg-surface z-40">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              aria-selected={currentTab === tab}
              role="tab"
              className={`flex-1 pb-3 text-center font-semibold text-sm relative ${currentTab === tab ? 'text-primary' : 'text-on-surface-variant'}`}
            >
              {tab}
              {currentTab === tab && <motion.div layoutId="tabIndicator" className="absolute bottom-0 left-0 w-full h-[3px] bg-primary rounded-t-full" />}
            </button>
          ))}
        </div>

        <main className="flex-1 flex flex-col px-5 py-6 gap-6 pb-32">
          {currentTab === '맞춤추천' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
              <div className="flex overflow-x-auto gap-2 pb-1 -mx-5 px-5 snap-x" style={{ scrollbarWidth: 'none' }}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategory(cat)}
                    disabled={loading}
                    aria-pressed={activeCategory === cat}
                    className={`snap-start flex-none px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-colors ${
                      activeCategory === cat
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white text-on-surface-variant border border-outline-variant hover:bg-surface-container-low shadow-sm'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl p-2 shadow-sm border border-outline-variant flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wand2 size={20} className="text-primary" />
                </div>
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !loading) void loadRecipes(); }}
                  placeholder="오늘은 자극적인게 땡겨"
                  aria-label="추천 요청 입력"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm outline-none"
                />
                <button
                  onClick={() => void loadRecipes()}
                  disabled={loading}
                  aria-label="추천 받기"
                  className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  <Send size={18} />
                </button>
              </div>

              <section className="bg-primary-container/20 rounded-xl p-6 flex items-start gap-4 border border-primary-container/30 mt-2">
                <ChefHat size={40} className="text-primary shrink-0" />
                <p className="text-lg leading-relaxed text-on-surface">
                  냉장고 살펴봤어요! <br />
                  {urgent.length > 0 ? (
                    <><span className="font-bold text-primary">곧 상하는 {urgent.slice(0, 2).map((i) => i.name).join('·')}</span>부터 쓸게요.</>
                  ) : (
                    <>지금 있는 재료로 만들 수 있는 메뉴를 골랐어요.</>
                  )}
                </p>
              </section>

              {!loading && !error && recipes.length > 0 && (
                <div className="flex flex-col gap-3 -mt-2">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-5 px-5" style={{ scrollbarWidth: 'none' }}>
                    <SlidersHorizontal size={16} className="text-outline shrink-0" aria-hidden />
                    {(Object.keys(RECIPE_SORT_LABELS) as RecipeSort[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => setSort(key)}
                        aria-pressed={sort === key}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          sort === key
                            ? 'bg-on-surface text-white'
                            : 'bg-white text-on-surface-variant border border-outline-variant'
                        }`}
                      >
                        {RECIPE_SORT_LABELS[key]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setOnlyAvailable((v) => !v)}
                    aria-pressed={onlyAvailable}
                    className={`self-start px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      onlyAvailable
                        ? 'bg-primary text-white'
                        : 'bg-white text-on-surface-variant border border-outline-variant'
                    }`}
                  >
                    <Check size={13} /> 지금 다 있는 것만
                  </button>
                </div>
              )}

              {loading ? (
                <section className="flex flex-col gap-4" aria-busy="true">
                  <p className="text-sm text-on-surface-variant flex items-center gap-2">
                    <RefreshCw size={15} className="animate-spin text-primary" />
                    {urgent.length > 0
                      ? `${urgent[0].name}부터 쓸 메뉴를 찾고 있어요...`
                      : '냉장고 재료로 만들 메뉴를 찾고 있어요...'}
                  </p>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-surface-variant animate-pulse space-y-3">
                      <div className="h-6 bg-surface-container-high rounded w-2/3" />
                      <div className="h-4 bg-surface-container-high rounded w-1/2" />
                      <div className="h-4 bg-surface-container-high rounded w-full" />
                    </div>
                  ))}
                </section>
              ) : error ? (
                <section className="bg-white rounded-xl p-6 text-center space-y-4 border border-surface-variant">
                  <p className="text-sm text-error">{error}</p>
                  <button onClick={() => void loadRecipes()} className="px-6 h-11 rounded-xl bg-primary text-white font-semibold">
                    다시 시도
                  </button>
                </section>
              ) : (
                <section className="flex flex-col gap-4">
                  {visibleRecipes.length === 0 && (
                    <div className="bg-white rounded-xl p-6 text-center space-y-2 border border-surface-variant">
                      <p className="text-sm text-on-surface-variant">지금 재료만으로 만들 수 있는 메뉴가 없어요.</p>
                      <button onClick={() => setOnlyAvailable(false)} className="text-sm text-primary font-semibold">
                        조금 사야 하는 메뉴도 보기
                      </button>
                    </div>
                  )}
                  {visibleRecipes.map((recipe) => (
                    <article
                      key={recipe.title}
                      onClick={() => openDetail(recipe.title)}
                      className="bg-white rounded-xl p-5 shadow-sm border border-surface-variant flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 pr-2">
                          <h2 className="text-xl font-semibold">{recipe.title}</h2>
                          <div className="flex gap-2 mt-1">
                            <span className="bg-surface-container-high px-2 py-1 rounded-full text-xs">⏱️ {recipe.time}</span>
                            <span className="bg-surface-container-high px-2 py-1 rounded-full text-xs">🔥 {recipe.difficulty}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => onToggleSave({ title: recipe.title, source: 'ai', time: recipe.time, difficulty: recipe.difficulty, author: 'AI 추천', tags: recipe.tags }, e)}
                          aria-label={savedTitles.has(recipe.title) ? '저장 해제' : '레시피 저장'}
                          className="p-1 -mt-1 -mr-1 text-outline hover:text-primary transition-colors shrink-0"
                        >
                          <Bookmark size={24} className={savedTitles.has(recipe.title) ? 'fill-primary text-primary' : ''} />
                        </button>
                      </div>
                      <CoverageBadge recipe={recipe} />
                      <p className="text-sm font-semibold text-tertiary-container flex items-center gap-1">
                        {recipe.warningType === 'alert' ? <AlertTriangle size={16} /> : <Info size={16} />}
                        {recipe.warning}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {recipe.tags.map((tag, idx) => (
                          <span key={idx} className={`px-3 py-1 rounded-full text-xs ${idx < 2 ? 'bg-primary-container/30 text-on-primary-container border border-primary-container/50' : 'bg-surface-container-high text-on-surface-variant'}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      {recipe.substitutes.length > 0 && (
                        <div className="mt-2 p-3 bg-surface-container-low rounded-lg border border-surface-variant flex flex-col gap-1">
                          <span className="text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                            <RefreshCw size={14} /> 대체 식재료 추천
                          </span>
                          {recipe.substitutes.map((sub, idx) => (
                            <span key={idx} className="text-sm text-on-surface">
                              <span className="line-through text-outline">{sub.missing}</span> 대신 <b className="text-primary">{sub.replaceWith}</b>
                            </span>
                          ))}
                        </div>
                      )}
                      <span className="mt-1 text-sm font-semibold text-primary flex items-center gap-1">
                        만드는 법 보기 <ChevronRight size={16} />
                      </span>
                    </article>
                  ))}
                  {onlyAvailable && hiddenByFilter > 0 && (
                    <button
                      onClick={() => setOnlyAvailable(false)}
                      className="text-sm text-on-surface-variant py-2 hover:text-primary transition-colors"
                    >
                      재료가 조금 부족한 메뉴 {hiddenByFilter}개 더 보기
                    </button>
                  )}
                </section>
              )}
            </motion.div>
          )}

          {currentTab === '커뮤니티' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <h2 className="text-lg font-bold mb-2">이번 주 인기 랭킹 🏆</h2>
              {communityList.length === 0 ? sharedEmptyState('커뮤니티') : communityList.map((recipe, idx) => (
                <article key={recipe.id} className="bg-white rounded-xl p-5 shadow-sm border border-surface-variant flex items-center gap-4 hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 z-10 ${idx < 3 ? 'bg-tertiary text-white shadow-md' : 'bg-surface-variant text-on-surface-variant'}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 z-10 pr-2 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <button onClick={() => openDetail(recipe.title)} className="text-left">
                        <h3 className="text-lg font-bold text-on-surface leading-tight mb-1">{recipe.title}</h3>
                      </button>
                      <button
                        onClick={(e) => onToggleSave({ title: recipe.title, source: 'community', time: '', difficulty: '', author: recipe.author, tags: recipe.tags }, e)}
                        aria-label={savedTitles.has(recipe.title) ? '저장 해제' : '레시피 저장'}
                        className={`p-1 -mt-1 -mr-1 shrink-0 transition-colors ${savedTitles.has(recipe.title) ? 'text-primary' : 'text-outline hover:text-primary'}`}
                      >
                        <Bookmark size={20} className={savedTitles.has(recipe.title) ? 'fill-primary' : ''} />
                      </button>
                    </div>
                    <p className="text-sm text-on-surface-variant font-medium">{recipe.author}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {recipe.tags.map((tag) => (
                        <span key={tag} className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-md text-xs">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <HeartButton liked={likedIds.has(recipe.id)} likes={recipe.likes} onToggle={() => onToggleLike(recipe.id)} />
                </article>
              ))}
            </motion.div>
          )}

          {currentTab === '셀럽/쉐프' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <h2 className="text-lg font-bold mb-2">인증된 프로의 맛 👨‍🍳</h2>
              {celebList.length === 0 ? sharedEmptyState('셀럽/쉐프') : celebList.map((recipe) => (
                <article key={recipe.id} className="bg-white rounded-xl p-5 shadow-sm border border-surface-variant flex justify-between items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="flex-1 pr-2 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <button onClick={() => openDetail(recipe.title)} className="text-left">
                        <h3 className="text-lg font-bold text-on-surface leading-tight mb-1">{recipe.title}</h3>
                      </button>
                      <button
                        onClick={(e) => onToggleSave({ title: recipe.title, source: 'celeb', time: '', difficulty: '', author: recipe.author, tags: recipe.tags }, e)}
                        aria-label={savedTitles.has(recipe.title) ? '저장 해제' : '레시피 저장'}
                        className={`p-1 -mt-1 -mr-1 shrink-0 transition-colors ${savedTitles.has(recipe.title) ? 'text-primary' : 'text-outline hover:text-primary'}`}
                      >
                        <Bookmark size={20} className={savedTitles.has(recipe.title) ? 'fill-primary' : ''} />
                      </button>
                    </div>
                    <p className="text-sm text-on-surface-variant font-medium">{recipe.author}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {recipe.tags.map((tag) => (
                        <span key={tag} className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-md text-xs font-medium">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <HeartButton liked={likedIds.has(recipe.id)} likes={recipe.likes} onToggle={() => onToggleLike(recipe.id)} />
                </article>
              ))}
            </motion.div>
          )}
        </main>

        {currentTab === '맞춤추천' && !loading && (
          <div className="fixed bottom-0 left-0 w-full md:max-w-md md:left-1/2 md:-translate-x-1/2 bg-gradient-to-t from-surface via-surface to-transparent pt-10 pb-8 px-5 z-40">
            <button
              onClick={() => {
                if (recipes.length === 0) {
                  toast.show('먼저 추천을 받아볼까요?');
                  return;
                }
                void loadRecipes({ exclude: recipes.map((r) => r.title) });
              }}
              className="w-full h-14 bg-primary text-white rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 hover:bg-primary/90"
            >
              <RefreshCw size={20} /> 다른 메뉴 추천받기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
