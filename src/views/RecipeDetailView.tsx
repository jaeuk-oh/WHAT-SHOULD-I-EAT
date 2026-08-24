import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Bookmark, Check, ChefHat, Circle, Info, Lightbulb, Share2, ShoppingCart } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import LoadingMessages from '../components/LoadingMessages';
import RecipeVideos from '../components/RecipeVideos';
import { useToast } from '../components/Toast';
import { ApiError, fetchRecipeDetail } from '../lib/api';
import { matchesIngredient } from '../types';
import type { IngredientVM, RecipeDetail, SavedRecipeInput } from '../types';

/**
 * 요리를 마치면 쓴 재료가 냉장고에서 빠져야 한다.
 * 이 연결이 없으면 사용자가 따로 정리해야 하고, 결국 아무도 정리하지 않아
 * 재고와 소진율 지표가 둘 다 망가진다.
 */
function CookedSheet({
  matched,
  onClose,
  onConfirm,
}: {
  matched: IngredientVM[];
  onClose: () => void;
  onConfirm: (selected: IngredientVM[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(matched.map((i) => i.id)),
  );

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selected = matched.filter((i) => selectedIds.has(i.id));

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 shadow-xl flex flex-col gap-4 max-h-[85vh]"
      >
        <div className="space-y-1 text-center">
          <h3 className="text-xl font-bold text-on-surface">맛있게 드셨나요?</h3>
          <p className="text-sm text-on-surface-variant">사용한 재료를 냉장고에서 정리할게요.</p>
        </div>

        <ul className="flex-1 overflow-y-auto space-y-2">
          {matched.map((item) => {
            const checked = selectedIds.has(item.id);
            return (
              <li key={item.id}>
                <button
                  onClick={() => toggle(item.id)}
                  aria-pressed={checked}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    checked ? 'border-primary bg-primary/5' : 'border-surface-variant bg-white'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${checked ? 'bg-primary text-white' : 'border border-outline'}`}>
                    {checked && <Check size={13} />}
                  </span>
                  <span className="flex-1 text-left text-sm font-medium">{item.name}</span>
                  {item.quantity && <span className="text-xs text-on-surface-variant">{item.quantity}</span>}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-outline text-center">일부만 썼다면 체크를 해제하세요.</p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl bg-surface-container-high text-on-surface font-semibold hover:bg-surface-dim transition-colors">
            취소
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="flex-1 h-12 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
          >
            {selected.length > 0 ? `${selected.length}개 정리하기` : '정리 없이 완료'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function RecipeDetailView({
  ingredients,
  savedTitles,
  onToggleSave,
  onCooked,
}: {
  ingredients: IngredientVM[];
  savedTitles: Set<string>;
  onToggleSave: (recipe: SavedRecipeInput, e: React.MouseEvent) => void;
  onCooked: (items: IngredientVM[]) => Promise<void>;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { title: rawTitle } = useParams<{ title: string }>();
  const title = rawTitle ? decodeURIComponent(rawTitle) : '';

  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [showCooked, setShowCooked] = useState(false);

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

  // 레시피가 요구하는 재료 중 실제로 내 냉장고에 있는 것들
  const matched = detail
    ? ingredients.filter((fridge) =>
        detail.ingredients.some((need) => matchesIngredient(need.name, fridge.name)),
      )
    : [];

  const share = async () => {
    const url = window.location.href;
    const shareData = { title: `${title} — 냉털메이트`, text: `${title} 만드는 법`, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('링크를 복사했어요.');
    } catch (e) {
      // 사용자가 공유 시트를 닫은 경우는 오류가 아니다
      if ((e as { name?: string }).name === 'AbortError') return;
      console.error('공유 실패:', e);
      toast.error('공유하지 못했어요.');
    }
  };

  const handleCooked = async (selected: IngredientVM[]) => {
    setShowCooked(false);
    try {
      await onCooked(selected);
      navigate('/', { replace: true });
    } catch {
      // onCooked 안에서 토스트로 안내한다
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <div className="w-full max-w-md mx-auto bg-surface min-h-screen">
        <AppHeader title="만드는 법" fallback="/recipes" />

        <main className="flex-1 flex flex-col px-5 py-4 gap-6 pb-32">
          {loading ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <LoadingMessages
                messages={['조리법을 준비하고 있어요...', '재료와 분량을 확인하고 있어요...', '거의 다 됐어요...']}
                className="text-sm font-semibold text-primary"
              />
              <div className="flex flex-col gap-4 animate-pulse">
                <div className="h-8 bg-surface-container-high rounded w-3/4" />
                <div className="h-4 bg-surface-container-high rounded w-1/2" />
                <div className="h-32 bg-surface-container-high rounded-xl" />
                <div className="h-48 bg-surface-container-high rounded-xl" />
              </div>
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
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={share}
                      aria-label="레시피 공유"
                      className="p-1 text-outline hover:text-primary transition-colors"
                    >
                      <Share2 size={24} />
                    </button>
                    <button
                      onClick={(e) =>
                        onToggleSave(
                          { title: detail.title, source: 'ai', time: detail.time, difficulty: detail.difficulty, author: 'AI 추천', tags: [] },
                          e,
                        )
                      }
                      aria-label={saved ? '저장 해제' : '레시피 저장'}
                      className="p-1 text-outline hover:text-primary transition-colors"
                    >
                      <Bookmark size={26} className={saved ? 'fill-primary text-primary' : ''} />
                    </button>
                  </div>
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
                <ol className="relative space-y-3">
                  <div className="absolute left-[30px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-transparent via-outline-variant to-transparent" aria-hidden="true" />
                  {detail.steps.map((step, idx) => {
                    const done = doneSteps.has(idx);
                    return (
                      <li key={idx}>
                        <button
                          onClick={() => toggleStep(idx)}
                          aria-pressed={done}
                          className={`relative z-10 w-full text-left bg-white rounded-xl p-4 shadow-sm border flex gap-3 transition-colors ${done ? 'border-primary/40 bg-primary/5' : 'border-surface-variant'}`}
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

              {matched.length > 0 && (
                <button
                  onClick={() => setShowCooked(true)}
                  className="w-full h-14 rounded-xl bg-primary text-white font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                >
                  <ChefHat size={20} /> 다 만들었어요
                </button>
              )}
            </motion.div>
          )}
        </main>
      </div>

      {showCooked && (
        <CookedSheet
          matched={matched}
          onClose={() => setShowCooked(false)}
          onConfirm={handleCooked}
        />
      )}
    </div>
  );
}
