import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useToast } from './components/Toast';
import {
  addIngredients,
  consumeIngredient,
  saveRecipe,
  subscribeHistory,
  subscribeIngredients,
  subscribeLikes,
  subscribeSavedRecipes,
  toggleLike as toggleLikeDoc,
  unsaveRecipe,
} from './lib/db';
import {
  daysLeft as calcDaysLeft,
  startOfMonth,
  type ConsumeAction,
  type HistoryEntry,
  type Ingredient,
  type IngredientVM,
  type NewIngredient,
  type SavedRecipe,
  type SavedRecipeInput,
} from './types';
import HomeView from './views/HomeView';
import LoginView from './views/LoginView';
import ReceiptView from './views/ReceiptView';
import RecipeView from './views/RecipeView';
import RecipeDetailView from './views/RecipeDetailView';
import SavedView from './views/SavedView';
import SettingsView from './views/SettingsView';
import { PrivacyView, TermsView } from './views/LegalView';

function SplashScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-20 h-20 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-outline-variant/30">
          <ShoppingBag size={40} className="text-primary" />
        </div>
        <span className="text-xl font-bold text-primary">냉털메이트</span>
      </div>
    </div>
  );
}

/**
 * 날짜가 바뀌면 D-day를 다시 계산해야 한다.
 * 탭을 켜둔 채 자정을 넘기거나, 백그라운드에 뒀다 돌아오는 경우를 모두 처리한다.
 */
function useDayTick(): string {
  const [today, setToday] = useState(() => new Date().toDateString());

  useEffect(() => {
    const check = () => {
      const now = new Date().toDateString();
      setToday((prev) => (prev === now ? prev : now));
    };
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return today;
}

export default function App() {
  const { user, loading: authLoading, error: authError, login, logout } = useAuth();
  const toast = useToast();
  const today = useDayTick();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (!user) {
      setIngredients([]);
      setSavedRecipes([]);
      setLikedIds(new Set());
      setHistory([]);
      return;
    }
    const uid = user.uid;
    const unsubs = [
      subscribeIngredients(uid, setIngredients, (e) => console.error('재료 구독 실패:', e)),
      subscribeSavedRecipes(uid, setSavedRecipes, (e) => console.error('저장 레시피 구독 실패:', e)),
      subscribeLikes(uid, setLikedIds, (e) => console.error('좋아요 구독 실패:', e)),
      subscribeHistory(uid, startOfMonth(), setHistory, (e) => console.error('소진 기록 구독 실패:', e)),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user?.uid]);

  const ingredientVMs: IngredientVM[] = useMemo(
    () => ingredients.map((i) => ({ ...i, daysLeft: calcDaysLeft(i.expiresAt) })),
    // today가 바뀌면(자정 통과) D-day를 다시 계산한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ingredients, today],
  );

  const savedTitles = useMemo(() => new Set(savedRecipes.map((r) => r.title)), [savedRecipes]);

  const toggleSave = (recipe: SavedRecipeInput, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) return;
    const wasSaved = savedTitles.has(recipe.title);
    const action = wasSaved ? unsaveRecipe(user.uid, recipe.title) : saveRecipe(user.uid, recipe);
    action
      .then(() => toast.success(wasSaved ? '저장을 해제했어요.' : '레시피를 저장했어요.'))
      .catch((err) => {
        console.error('레시피 저장/해제 실패:', err);
        toast.error('처리에 실패했어요. 잠시 후 다시 시도해주세요.');
      });
  };

  const handleToggleLike = (recipeId: string) => {
    if (!user) return;
    toggleLikeDoc(user.uid, recipeId, likedIds.has(recipeId)).catch((err) => {
      console.error('좋아요 처리 실패:', err);
      toast.error('좋아요 처리에 실패했어요.');
    });
  };

  const handleSaveReceipt = async (items: NewIngredient[]) => {
    if (!user) return;
    await addIngredients(user.uid, items);
  };

  const handleAddIngredient = async (item: NewIngredient) => {
    if (!user) return;
    try {
      await addIngredients(user.uid, [item]);
      toast.success(`${item.name}을(를) 추가했어요.`);
    } catch (e) {
      console.error('재료 추가 실패:', e);
      toast.error('재료 추가에 실패했어요. 잠시 후 다시 시도해주세요.');
      throw e;
    }
  };

  const handleConsume = (item: IngredientVM, action: ConsumeAction) => {
    if (!user) return;
    consumeIngredient(user.uid, item, action)
      .then(() =>
        toast.success(action === 'eaten' ? `${item.name}, 잘 드셨어요!` : `${item.name}을(를) 정리했어요.`),
      )
      .catch((e) => {
        console.error('재료 정리 실패:', e);
        toast.error('처리에 실패했어요. 잠시 후 다시 시도해주세요.');
      });
  };

  if (authLoading) return <SplashScreen />;

  return (
    <div className="min-h-screen bg-background text-on-background font-sans overflow-x-hidden">
      <Routes>
        {/* 약관·방침은 로그인 전에도 볼 수 있어야 한다 */}
        <Route path="/terms" element={<TermsView />} />
        <Route path="/privacy" element={<PrivacyView />} />

        {!user ? (
          <Route path="*" element={<LoginView onLogin={login} error={authError} />} />
        ) : (
          <>
            <Route
              path="/"
              element={
                <HomeView
                  ingredients={ingredientVMs}
                  history={history}
                  photoURL={user.photoURL}
                  onAdd={handleAddIngredient}
                  onConsume={handleConsume}
                />
              }
            />
            <Route path="/receipt" element={<ReceiptView onSave={handleSaveReceipt} />} />
            <Route
              path="/recipes"
              element={
                <RecipeView
                  ingredients={ingredientVMs}
                  savedTitles={savedTitles}
                  likedIds={likedIds}
                  onToggleSave={toggleSave}
                  onToggleLike={handleToggleLike}
                />
              }
            />
            <Route
              path="/recipes/:title"
              element={
                <RecipeDetailView
                  ingredients={ingredientVMs}
                  savedTitles={savedTitles}
                  onToggleSave={toggleSave}
                />
              }
            />
            <Route path="/saved" element={<SavedView savedRecipes={savedRecipes} onToggleSave={toggleSave} />} />
            <Route path="/settings" element={<SettingsView user={user} onLogout={logout} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </div>
  );
}
