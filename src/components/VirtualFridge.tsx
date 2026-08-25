import React from 'react';
import { Check, Snowflake } from 'lucide-react';
import { ItemIcon } from './ItemIcon';
import { FRIDGE_TYPE_LABELS, type FridgeType, type IngredientVM } from '../types';

/**
 * 실제 냉장고를 열어보지 않아도 안에 뭐가 있는지 보고, 쓸 재료를 직접 터치해서 고르는 뷰.
 * fridgeType(설정에서 고른 스타일)에 따라 문 개수·냉동실 유무·크기가 실제로 달라진다 —
 * 셋이 거의 똑같아 보인다는 피드백을 받고 구조 자체를 다르게 그리도록 고쳤다.
 */
export default function VirtualFridge({
  type,
  items,
  selected,
  onToggleSelect,
}: {
  type: FridgeType;
  items: IngredientVM[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const doors = type === 'sidebyside' ? 2 : 1;
  const hasFreezer = type === 'standard';
  const isMini = type === 'mini';

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`rounded-3xl bg-on-surface/90 p-3 shadow-inner transition-all ${isMini ? 'w-[76%]' : 'w-full'}`}
      >
        <div className={`flex ${doors === 2 ? 'gap-1' : 'flex-col'}`}>
          {Array.from({ length: doors }).map((_, doorIdx) => (
            <div
              key={doorIdx}
              className={`relative flex-1 bg-white/95 overflow-hidden ${
                doors === 2 ? (doorIdx === 0 ? 'rounded-l-2xl' : 'rounded-r-2xl') : 'rounded-2xl'
              }`}
            >
              {/* 문 손잡이 — 경첩 반대쪽(바깥쪽)에 둔다 */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 w-1 h-9 rounded-full bg-on-surface/25 z-10 ${
                  doors === 2 ? (doorIdx === 0 ? 'right-1.5' : 'left-1.5') : 'right-1.5'
                }`}
              />

              {hasFreezer && (
                <div className="flex items-center gap-1.5 px-3 h-8 bg-primary-container/35 border-b border-primary-container/50">
                  <Snowflake size={12} className="text-primary shrink-0" />
                  <span className="text-[10px] font-semibold text-primary">냉동실</span>
                </div>
              )}

              <div className={`p-3 ${isMini ? 'min-h-[130px]' : 'min-h-[176px]'}`}>
                {items.length === 0 ? (
                  <p className="text-xs text-on-surface-variant text-center py-10">냉장고가 비어있어요</p>
                ) : (
                  <div className="flex flex-wrap gap-2 content-start">
                    {items
                      .filter((_, i) => i % doors === doorIdx)
                      .map((item) => {
                        const isSelected = selected.has(item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => onToggleSelect(item.id)}
                            aria-pressed={isSelected}
                            className={`relative flex flex-col items-center gap-1 w-16 p-2 rounded-xl border transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/10'
                                : 'border-surface-variant bg-surface-container-low'
                            }`}
                          >
                            {isSelected && (
                              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
                                <Check size={10} />
                              </span>
                            )}
                            <span className="text-on-surface-variant">
                              <ItemIcon category={item.category} />
                            </span>
                            <span className="text-[10px] font-medium text-on-surface truncate w-full text-center">
                              {item.name}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-on-surface-variant">{FRIDGE_TYPE_LABELS[type]}</p>
    </div>
  );
}
