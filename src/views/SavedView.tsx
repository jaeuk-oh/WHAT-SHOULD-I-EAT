import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowLeft, Bookmark, ChevronRight } from 'lucide-react';
import type { IngredientCategory, IngredientVM, SavedRecipe, SavedRecipeInput } from '../types';
import RecipeDetailModal from './RecipeDetailModal';

const sourceLabel: Record<SavedRecipe['source'], string> = {
  ai: 'AI 추천',
  community: '커뮤니티',
  celeb: '셀럽/쉐프',
};

export default function SavedView({ onBack, savedRecipes, ingredients, onToggleSave, onCook }: {
  onBack: () => void;
  savedRecipes: SavedRecipe[];
  ingredients: IngredientVM[];
  onToggleSave: (recipe: SavedRecipeInput, e: React.MouseEvent) => void;
  onCook: (items: { id: string; name: string; category: IngredientCategory }[]) => Promise<void>;
}) {
  const [detail, setDetail] = useState<SavedRecipe | null>(null);
  const hasDetail = (r: SavedRecipe) => (r.steps && r.steps.length > 0) || (r.usedIngredients && r.usedIngredients.length > 0);
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <div className="w-full max-w-md mx-auto bg-surface min-h-screen relative">
        <header className="flex justify-between items-center p-5 sticky top-0 bg-surface z-50">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-surface-variant">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">저장한 레시피</h1>
          <div className="w-10"></div>
        </header>

        <main className="flex-1 flex flex-col px-5 py-2 gap-4 pb-10">
          {savedRecipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 mt-20 text-on-surface-variant">
              <Bookmark size={48} className="mb-4 text-outline" />
              <p>아직 저장한 레시피가 없어요.</p>
            </div>
          ) : (
            savedRecipes.map((recipe) => (
              <article
                key={recipe.id}
                onClick={() => hasDetail(recipe) && setDetail(recipe)}
                className={`bg-white rounded-xl p-5 shadow-sm border border-surface-variant flex flex-col gap-3 ${hasDetail(recipe) ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <h2 className="text-lg font-bold text-on-surface leading-tight mb-1">{recipe.title}</h2>
                    <p className="text-sm text-on-surface-variant">
                      {sourceLabel[recipe.source]}
                      {recipe.author && recipe.source !== 'ai' && ` · ${recipe.author}`}
                      {recipe.time && ` · ⏱️ ${recipe.time}`}
                      {recipe.difficulty && ` · ${recipe.difficulty}`}
                    </p>
                    {recipe.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {recipe.tags.map((tag, idx) => (
                          <span key={idx} className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-md text-xs font-medium">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={(e) => onToggleSave(recipe, e)} className="p-1 -mt-1 -mr-1 text-primary transition-colors shrink-0" aria-label="저장 해제">
                    <Bookmark size={24} className="fill-primary" />
                  </button>
                </div>
                {hasDetail(recipe) && (
                  <div className="flex justify-end">
                    <span className="text-sm font-semibold text-primary flex items-center gap-0.5">레시피 보기 <ChevronRight size={16} /></span>
                  </div>
                )}
              </article>
            ))
          )}
        </main>
      </div>

      <AnimatePresence>
        {detail && (
          <RecipeDetailModal
            detail={{
              title: detail.title,
              subtitle: `${sourceLabel[detail.source]}${detail.author && detail.source !== 'ai' ? ` · ${detail.author}` : ''}`,
              time: detail.time,
              difficulty: detail.difficulty,
              servings: detail.servings,
              tags: detail.tags,
              usedIngredients: detail.usedIngredients,
              steps: detail.steps,
            }}
            saved={true}
            onToggleSave={(e) => { onToggleSave(detail, e); setDetail(null); }}
            myIngredients={ingredients}
            onCook={async (items) => { await onCook(items); setDetail(null); }}
            onClose={() => setDetail(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
