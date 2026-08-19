import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Bookmark, Check, Circle, Info, Lightbulb, ShoppingCart } from 'lucide-react';
import { useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import RecipeVideos from '../components/RecipeVideos';
import { ApiError, fetchRecipeDetail } from '../lib/api';
import type { IngredientVM, RecipeDetail, SavedRecipeInput } from '../types';

export default function RecipeDetailView({
  ingredients,
  savedTitles,
  onToggleSave,
}: {
  ingredients: IngredientVM[];
  savedTitles: Set<string>;
  onToggleSave: (recipe: SavedRecipeInput, e: React.MouseEvent) => void;
}) {
  const { title: rawTitle } = useParams<{ title: string }>();
  const title = rawTitle ? decodeURIComponent(rawTitle) : '';

  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    if (!title) {
      setError('레시피를 찾을 수 없어요.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetchRecipeDetail(
      title,
      ingredients.map((i) => ({ name: i.name, category: i.category, daysLeft: i.daysLeft })),
    )
      .then((result) => { if (!cancelled) setDetail(result); })
      .catch((e) => {
        console.error('조리법 조회 실패:', e);
        if (!cancelled) setError(e instanceof ApiError ? e.message : '조리법을 불러오지 못했어요.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // 재료 배열은 매 렌더 새로 만들어지므로 제목이 바뀔 때만 다시 부른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const toggleStep = (idx: number) =>
    setDoneSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const saved = savedTitles.has(title);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <div className="w-full max-w-md mx-auto bg-surface min-h-screen">
        <AppHeader title="만드는 법" fallback="/recipes" />

        <main className="flex-1 flex flex-col px-5 py-4 gap-6 pb-32">
          {loading ? (
            <div className="flex flex-col gap-4 animate-pulse" aria-busy="true">
              <div className="h-8 bg-surface-container-high rounded w-3/4" />
              <div className="h-4 bg-surface-container-high rounded w-1/2" />
              <div className="h-32 bg-surface-container-high rounded-xl" />
              <div className="h-48 bg-surface-container-high rounded-xl" />
            </div>
          ) : error || !detail ? (
            <div className="bg-white rounded-xl p-6 text-center space-y-3 border border-surface-variant mt-10">
              <p className="text-sm text-error">{error ?? '조리법을 불러오지 못했어요.'}</p>
              <p className="text-xs text-outline">잠시 후 다시 시도해주세요.</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
              <section className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <h1 className="text-2xl font-bold leading-tight">{detail.title}</h1>
                  <button
                    onClick={(e) =>
                      onToggleSave(
                        { title: detail.title, source: 'ai', time: detail.time, difficulty: detail.difficulty, author: 'AI 추천', tags: [] },
                        e,
                      )
                    }
                    aria-label={saved ? '저장 해제' : '레시피 저장'}
                    className="p-1 shrink-0 text-outline hover:text-primary transition-colors"
                  >
                    <Bookmark size={26} className={saved ? 'fill-primary text-primary' : ''} />
                  </button>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed">{detail.summary}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-surface-container-high px-3 py-1 rounded-full text-xs">⏱️ {detail.time}</span>
                  <span className="bg-surface-container-high px-3 py-1 rounded-full text-xs">🔥 {detail.difficulty}</span>
                  <span className="bg-surface-container-high px-3 py-1 rounded-full text-xs">🍽️ {detail.servings}</span>
                </div>
              </section>

              <section className="bg-white rounded-xl p-5 shadow-sm border border-surface-variant space-y-3">
                <h2 className="text-lg font-bold">재료</h2>
                <ul className="space-y-2">
                  {detail.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        {ing.owned ? (
                          <Check size={16} className="text-primary shrink-0" aria-hidden />
                        ) : (
                          <ShoppingCart size={16} className="text-tertiary shrink-0" aria-hidden />
                        )}
                        <span className={ing.owned ? 'text-on-surface' : 'text-on-surface-variant'}>{ing.name}</span>
                      </span>
                      <span className="text-on-surface-variant shrink-0">{ing.amount}</span>
                    </li>
                  ))}
                </ul>
                {detail.ingredients.some((i) => !i.owned) && (
                  <p className="text-xs text-outline flex items-center gap-1 pt-1 border-t border-surface-variant">
                    <Info size={13} /> 장바구니 아이콘은 냉장고에 없는 재료예요.
                  </p>
                )}
              </section>

              <RecipeVideos title={detail.title} />

              <section className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-bold">조리 순서</h2>
                  <span className="text-xs text-outline">{doneSteps.size} / {detail.steps.length} 완료</span>
                </div>
                <ol className="space-y-3">
                  {detail.steps.map((step, idx) => {
                    const done = doneSteps.has(idx);
                    return (
                      <li key={idx}>
                        <button
                          onClick={() => toggleStep(idx)}
                          aria-pressed={done}
                          className={`w-full text-left bg-white rounded-xl p-4 shadow-sm border flex gap-3 transition-colors ${done ? 'border-primary/40 bg-primary/5' : 'border-surface-variant'}`}
                        >
                          <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${done ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>
                            {done ? <Check size={16} /> : idx + 1}
                          </span>
                          <span className="flex-1 space-y-1">
                            <span className={`block text-sm leading-relaxed ${done ? 'text-outline line-through' : 'text-on-surface'}`}>
                              {step.text}
                            </span>
                            {step.tip && (
                              <span className="flex text-xs text-tertiary items-start gap-1">
                                <Lightbulb size={12} className="mt-0.5 shrink-0" /> {step.tip}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>

              {detail.tips.length > 0 && (
                <section className="bg-secondary-container/40 rounded-xl p-5 border border-secondary-container space-y-2">
                  <h2 className="text-sm font-bold text-on-secondary-container flex items-center gap-1">
                    <Lightbulb size={16} /> 알아두면 좋아요
                  </h2>
                  <ul className="space-y-1">
                    {detail.tips.map((tip, idx) => (
                      <li key={idx} className="text-sm text-on-surface flex items-start gap-2">
                        <Circle size={6} className="mt-2 shrink-0 fill-current" /> {tip}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}
