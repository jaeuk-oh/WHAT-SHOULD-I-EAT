import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowLeft, Bookmark, ChefHat, Info, RefreshCw, Send, Wand2 } from 'lucide-react';
import { fetchRecommendations } from '../lib/api';
import type { IngredientVM, RecommendedRecipe, SavedRecipeInput } from '../types';

const categories = ['전체', '다이어트', '간단한', '자극적인', '비건'];

// Stage 5에서 Firestore recipes 컬렉션으로 대체 예정 (시드 데이터 원본)
export const communityRecipes = [
  { id: 101, title: '자취생 10분컷 참치마요 덮밥', author: '요리왕비룡', likes: 1245, rank: 1, tags: ['자취', '초간단'] },
  { id: 102, title: '식단러의 눈물젖은 오트밀죽', author: '다이어터', likes: 890, rank: 2, tags: ['다이어트', '오트밀'] },
  { id: 103, title: '할머니 비밀 레시피, 돼지갈비찜', author: '한식러버', likes: 756, rank: 3, tags: ['돼지고기', '전통'] },
  { id: 104, title: '남은 치킨 200% 활용 볶음밥', author: '치느님', likes: 432, rank: 4, tags: ['활용', '치킨'] },
];

export const celebRecipes = [
  { id: 201, title: '어남선생 류수영의 평생 짜장면', author: '류수영', likes: 5430, tags: ['셀럽', '면요리'] },
  { id: 202, title: '백종원의 만능 양파 볶음', author: '백종원', likes: 4321, tags: ['쉐프', '만능'] },
  { id: 203, title: '성시경 텐동 만들기', author: '성시경', likes: 3210, tags: ['먹을텐데', '튀김'] },
];

const HeartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
);

export default function RecipeView({ onBack, ingredients, savedTitles, onToggleSave }: {
  onBack: () => void;
  ingredients: IngredientVM[];
  savedTitles: Set<string>;
  onToggleSave: (recipe: SavedRecipeInput, e: React.MouseEvent) => void;
}) {
  const [currentTab, setCurrentTab] = useState<'맞춤추천' | '커뮤니티' | '셀럽/쉐프'>('맞춤추천');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [aiPrompt, setAiPrompt] = useState('');
  const [recipes, setRecipes] = useState<RecommendedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const urgent = ingredients.filter(i => i.daysLeft <= 2);

  const loadRecipes = async (opts?: { exclude?: string[]; category?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const category = opts?.category ?? activeCategory;
      const result = await fetchRecommendations({
        ingredients: ingredients.map(i => ({ name: i.name, category: i.category, daysLeft: i.daysLeft })),
        category: category === '전체' ? undefined : category,
        prompt: aiPrompt.trim() || undefined,
        exclude: opts?.exclude,
      });
      setRecipes(result);
    } catch (e) {
      console.error('레시피 추천 실패:', e);
      setError(e instanceof Error ? e.message : '추천을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategory = (cat: string) => {
    setActiveCategory(cat);
    loadRecipes({ category: cat });
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <div className="w-full max-w-md mx-auto bg-surface min-h-screen relative">
        <header className="flex justify-between items-center p-5 sticky top-0 bg-surface z-50">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-surface-variant">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">오늘 뭐 먹지?</h1>
          <div className="w-10"></div>
        </header>

        <div className="flex px-5 pt-2 pb-0 border-b border-surface-variant sticky top-[72px] bg-surface z-40">
          {(['맞춤추천', '커뮤니티', '셀럽/쉐프'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setCurrentTab(tab)}
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
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleCategory(cat)}
                    disabled={loading}
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
                  onKeyDown={(e) => { if (e.key === 'Enter' && !loading) loadRecipes(); }}
                  placeholder="오늘은 자극적인게 땡겨"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm outline-none"
                />
                <button
                  onClick={() => loadRecipes()}
                  disabled={loading}
                  className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  <Send size={18} />
                </button>
              </div>

              <section className="bg-primary-container/20 rounded-xl p-6 flex items-start gap-4 border border-primary-container/30 mt-2">
                <div className="text-4xl"><ChefHat size={40} className="text-primary"/></div>
                <div>
                  <p className="text-lg leading-relaxed text-on-surface">
                    냉장고 살펴봤어요! <br/>
                    {urgent.length > 0 ? (
                      <><span className="font-bold text-primary">곧 상하는 {urgent.slice(0, 2).map(i => i.name).join('·')}</span>부터 쓸게요.</>
                    ) : (
                      <>지금 있는 재료로 만들 수 있는 메뉴를 골랐어요.</>
                    )}
                  </p>
                </div>
              </section>

              {loading ? (
                <section className="flex flex-col gap-4">
                  {[0, 1, 2].map(i => (
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
                  <button onClick={() => loadRecipes()} className="px-6 h-11 rounded-xl bg-primary text-white font-semibold">
                    다시 시도
                  </button>
                </section>
              ) : (
                <section className="flex flex-col gap-4">
                  {recipes.map(recipe => (
                    <article key={recipe.title} className="bg-white rounded-xl p-5 shadow-sm border border-surface-variant flex flex-col gap-3 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 pr-2">
                          <h2 className="text-xl font-semibold">{recipe.title}</h2>
                          <div className="flex gap-2 mt-1">
                            <span className="bg-surface-container-high px-2 py-1 rounded-full text-xs flex items-center gap-1">⏱️ {recipe.time}</span>
                            <span className="bg-surface-container-high px-2 py-1 rounded-full text-xs flex items-center gap-1">🔥 {recipe.difficulty}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => onToggleSave({ title: recipe.title, source: 'ai', time: recipe.time, difficulty: recipe.difficulty, author: 'AI 추천', tags: recipe.tags }, e)}
                          className="p-1 -mt-1 -mr-1 text-outline hover:text-primary transition-colors shrink-0"
                        >
                          <Bookmark size={24} className={savedTitles.has(recipe.title) ? 'fill-primary text-primary' : ''} />
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-tertiary-container flex items-center gap-1">
                        {recipe.warningType === 'alert' ? <AlertTriangle size={16} /> : <Info size={16} />}
                        {recipe.warning}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {recipe.tags.map((tag, idx) => (
                          <span key={idx} className={`px-3 py-1 rounded-full text-xs ${idx < 2 ? 'bg-primary-container/30 text-primary-fixed-variant border border-primary-container/50' : 'bg-surface-container-high text-on-surface-variant'}`}>
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
                    </article>
                  ))}
                </section>
              )}
            </motion.div>
          )}

          {currentTab === '커뮤니티' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold">이번 주 인기 랭킹 🏆</h2>
              </div>

              {communityRecipes.map(recipe => (
                <article key={recipe.id} className="bg-white rounded-xl p-5 shadow-sm border border-surface-variant flex items-center gap-4 hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 z-10 ${recipe.rank <= 3 ? 'bg-tertiary text-white shadow-md' : 'bg-surface-variant text-on-surface-variant'}`}>
                    {recipe.rank}
                  </div>
                  <div className="flex-1 z-10 pr-2">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-bold text-on-surface leading-tight mb-1">{recipe.title}</h3>
                      <button
                        onClick={(e) => onToggleSave({ title: recipe.title, source: 'community', time: '', difficulty: '', author: recipe.author, tags: recipe.tags }, e)}
                        className={`p-1 -mt-1 -mr-1 transition-colors ${savedTitles.has(recipe.title) ? 'text-primary' : 'text-outline hover:text-primary'}`}
                      >
                        <Bookmark size={20} className={savedTitles.has(recipe.title) ? 'fill-primary' : ''} />
                      </button>
                    </div>
                    <p className="text-sm text-on-surface-variant font-medium">{recipe.author}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {recipe.tags.map(tag => (
                        <span key={tag} className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-md text-xs">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center shrink-0 z-10">
                    <div className="w-10 h-10 rounded-full bg-surface-container-low text-error flex items-center justify-center">
                      <HeartIcon />
                    </div>
                    <span className="text-xs font-bold text-on-surface-variant mt-1">{recipe.likes.toLocaleString()}</span>
                  </div>
                  {recipe.rank === 1 && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary-container/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                  )}
                </article>
              ))}
            </motion.div>
          )}

          {currentTab === '셀럽/쉐프' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold">인증된 프로의 맛 👨‍🍳</h2>
              </div>

              {celebRecipes.map(recipe => (
                <article key={recipe.id} className="bg-white rounded-xl p-5 shadow-sm border border-surface-variant flex justify-between items-center hover:shadow-md transition-shadow">
                  <div className="flex-1 pr-2">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-bold text-on-surface leading-tight mb-1">{recipe.title}</h3>
                      <button
                        onClick={(e) => onToggleSave({ title: recipe.title, source: 'celeb', time: '', difficulty: '', author: recipe.author, tags: recipe.tags }, e)}
                        className={`p-1 -mt-1 -mr-1 transition-colors ${savedTitles.has(recipe.title) ? 'text-primary' : 'text-outline hover:text-primary'}`}
                      >
                        <Bookmark size={20} className={savedTitles.has(recipe.title) ? 'fill-primary' : ''} />
                      </button>
                    </div>
                    <p className="text-sm text-on-surface-variant font-medium">{recipe.author}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {recipe.tags.map(tag => (
                        <span key={tag} className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-md text-xs font-medium">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center shrink-0">
                    <div className="w-10 h-10 rounded-full bg-surface-container-low text-error flex items-center justify-center">
                      <HeartIcon />
                    </div>
                    <span className="text-xs font-bold text-on-surface-variant mt-1">{recipe.likes.toLocaleString()}</span>
                  </div>
                </article>
              ))}
            </motion.div>
          )}
        </main>

        {currentTab === '맞춤추천' && (
          <div className="fixed bottom-0 left-0 w-full md:max-w-md md:left-1/2 md:-translate-x-1/2 bg-gradient-to-t from-surface via-surface to-transparent pt-10 pb-8 px-5 z-40">
            <button
              onClick={() => loadRecipes({ exclude: recipes.map(r => r.title) })}
              disabled={loading}
              className="w-full h-14 bg-primary text-white rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 hover:bg-primary/90 disabled:opacity-60"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} /> 다른 메뉴 추천받기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
