import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Bookmark, Check, ChefHat, Info, RefreshCw, Utensils, X } from 'lucide-react';
import type { IngredientCategory, IngredientVM, RecipeIngredient } from '../types';

export interface RecipeDetail {
  title: string;
  subtitle?: string;
  time?: string;
  difficulty?: string;
  servings?: string;
  warning?: string;
  warningType?: 'alert' | 'info';
  tags: string[];
  usedIngredients?: RecipeIngredient[];
  steps?: string[];
  substitutes?: { missing: string; replaceWith: string }[];
}

type CookItem = { id: string; name: string; category: IngredientCategory };

// 레시피가 쓰는 재료명과 내 재고를 느슨하게 매칭 (부분 문자열 양방향)
function matches(myName: string, usedNames: string[]): boolean {
  const a = myName.replace(/\s/g, '');
  return usedNames.some((u) => {
    const b = u.replace(/\s/g, '');
    return b.length > 0 && (a.includes(b) || b.includes(a));
  });
}

export default function RecipeDetailModal({
  detail,
  saved,
  onToggleSave,
  myIngredients,
  onCook,
  onClose,
}: {
  detail: RecipeDetail;
  saved: boolean;
  onToggleSave: (e: React.MouseEvent) => void;
  myIngredients: IngredientVM[];
  onCook?: (items: CookItem[]) => Promise<void> | void;
  onClose: () => void;
}) {
  const usedNames = useMemo(() => (detail.usedIngredients ?? []).map((i) => i.name), [detail.usedIngredients]);
  const matchedIds = useMemo(
    () => new Set(myIngredients.filter((i) => matches(i.name, usedNames)).map((i) => i.id)),
    [myIngredients, usedNames],
  );

  const [cooking, setCooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(matchedIds);

  const canCook = Boolean(onCook) && myIngredients.length > 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const confirmCook = async () => {
    if (!onCook || saving) return;
    const items = myIngredients
      .filter((i) => selected.has(i.id))
      .map((i) => ({ id: i.id, name: i.name, category: i.category }));
    if (items.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onCook(items);
      onClose();
    } catch (e) {
      console.error('재료 차감 실패:', e);
      alert('재료 차감에 실패했어요. 잠시 후 다시 시도해주세요.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full max-w-md max-h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col overflow-hidden"
      >
        <header className="flex items-start justify-between gap-3 p-5 border-b border-surface-variant">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-on-surface leading-snug">{detail.title}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {detail.time && <span className="bg-surface-container-high px-2 py-1 rounded-full text-xs flex items-center gap-1">⏱️ {detail.time}</span>}
              {detail.difficulty && <span className="bg-surface-container-high px-2 py-1 rounded-full text-xs flex items-center gap-1">🔥 {detail.difficulty}</span>}
              {detail.servings && <span className="bg-surface-container-high px-2 py-1 rounded-full text-xs flex items-center gap-1">🍽️ {detail.servings}</span>}
            </div>
            {detail.subtitle && <p className="text-sm text-on-surface-variant mt-2">{detail.subtitle}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onToggleSave}
              className={`p-2 transition-colors ${saved ? 'text-primary' : 'text-outline hover:text-primary'}`}
              aria-label={saved ? '저장 해제' : '레시피 저장'}
            >
              <Bookmark size={22} className={saved ? 'fill-primary' : ''} />
            </button>
            <button onClick={onClose} className="p-2 text-outline hover:text-on-surface" aria-label="닫기">
              <X size={22} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {detail.warning && (
            <p className="text-sm font-semibold text-tertiary-container flex items-center gap-1">
              {detail.warningType === 'alert' ? <AlertTriangle size={16} /> : <Info size={16} />}
              {detail.warning}
            </p>
          )}

          {detail.usedIngredients && detail.usedIngredients.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-1"><Utensils size={16} /> 재료</h3>
              <div className="flex flex-col divide-y divide-surface-variant rounded-xl border border-surface-variant overflow-hidden">
                {detail.usedIngredients.map((ing, idx) => (
                  <div key={idx} className="flex justify-between items-center px-4 py-2.5 bg-white text-sm">
                    <span className="text-on-surface">{ing.name}</span>
                    <span className="text-on-surface-variant font-medium">{ing.amount}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {detail.substitutes && detail.substitutes.length > 0 && (
            <div className="p-3 bg-surface-container-low rounded-lg border border-surface-variant flex flex-col gap-1">
              <span className="text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                <RefreshCw size={14} /> 대체 식재료 추천
              </span>
              {detail.substitutes.map((sub, idx) => (
                <span key={idx} className="text-sm text-on-surface">
                  <span className="line-through text-outline">{sub.missing}</span> 대신 <b className="text-primary">{sub.replaceWith}</b>
                </span>
              ))}
            </div>
          )}

          {detail.steps && detail.steps.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-1"><ChefHat size={16} /> 만드는 법</h3>
              <ol className="flex flex-col gap-3">
                {detail.steps.map((step, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">{idx + 1}</span>
                    <p className="text-sm text-on-surface leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <p className="text-sm text-outline text-center py-4">이 레시피는 자세한 조리법이 저장되어 있지 않아요.</p>
          )}

          {cooking && canCook && (
            <section className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-4">
              <h3 className="text-sm font-bold text-on-surface">사용한 재료를 골라주세요</h3>
              <p className="text-xs text-on-surface-variant">체크한 재료를 냉장고에서 빼고 요리 기록에 남겨요.</p>
              <div className="flex flex-col gap-1 mt-1">
                {myIngredients.map((i) => {
                  const on = selected.has(i.id);
                  return (
                    <button
                      key={i.id}
                      onClick={() => toggle(i.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${on ? 'bg-primary text-white' : 'bg-white text-on-surface border border-surface-variant'}`}
                    >
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${on ? 'bg-white/20' : 'border border-outline-variant'}`}>
                        {on && <Check size={14} />}
                      </span>
                      <span className="flex-1">{i.name}</span>
                      <span className={`text-xs ${on ? 'text-white/80' : 'text-on-surface-variant'}`}>D-{i.daysLeft}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {canCook && (
          <div className="p-5 border-t border-surface-variant bg-surface">
            {cooking ? (
              <button
                onClick={confirmCook}
                disabled={saving}
                className="w-full py-4 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60"
              >
                <Check size={20} /> {saving ? '기록 중...' : `${selected.size}개 재료 쓰고 완료`}
              </button>
            ) : (
              <button
                onClick={() => setCooking(true)}
                className="w-full py-4 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 hover:bg-primary/90"
              >
                <ChefHat size={20} /> 이거 만들었어요
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
