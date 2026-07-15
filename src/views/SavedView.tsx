import React from 'react';
import { ArrowLeft, Bookmark } from 'lucide-react';
import type { SavedRecipe, SavedRecipeInput } from '../types';

const sourceLabel: Record<SavedRecipe['source'], string> = {
  ai: 'AI 추천',
  community: '커뮤니티',
  celeb: '셀럽/쉐프',
};

export default function SavedView({ onBack, savedRecipes, onToggleSave }: {
  onBack: () => void;
  savedRecipes: SavedRecipe[];
  onToggleSave: (recipe: SavedRecipeInput, e: React.MouseEvent) => void;
}) {
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
              <article key={recipe.id} className="bg-white rounded-xl p-5 shadow-sm border border-surface-variant flex flex-col gap-3">
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
                  <button onClick={(e) => onToggleSave(recipe, e)} className="p-1 -mt-1 -mr-1 text-primary transition-colors shrink-0">
                    <Bookmark size={24} className="fill-primary" />
                  </button>
                </div>
              </article>
            ))
          )}
        </main>
      </div>
    </div>
  );
}
