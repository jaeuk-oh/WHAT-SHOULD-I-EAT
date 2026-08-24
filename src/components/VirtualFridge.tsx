import React from 'react';
import { Check } from 'lucide-react';
import { ItemIcon } from './ItemIcon';
import type { FridgeType, IngredientVM } from '../types';

/**
 * 실제 냉장고를 열어보지 않아도 안에 뭐가 있는지 보고, 쓸 재료를 직접 터치해서 고르는 뷰.
 * 문 모양은 fridgeType(설정에서 고른 스타일)에 따라 살짝 다르지만 안의 재료 배치 로직은 동일하다.
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
  const hasFreezerLine = type === 'standard';

  return (
    <div className="rounded-3xl bg-on-surface/90 p-3 shadow-inner">
      <div className={`flex gap-2 ${doors === 2 ? '' : 'flex-col'}`}>
        {Array.from({ length: doors }).map((_, doorIdx) => (
          <div key={doorIdx} className="flex-1 rounded-2xl bg-white/95 overflow-hidden">
            {hasFreezerLine && <div className="h-8 bg-surface-container-high border-b border-outline-variant/40" />}
            <div className="p-3 min-h-[180px]">
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
  );
}
