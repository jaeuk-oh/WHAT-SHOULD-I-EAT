import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Refrigerator } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useToast } from './components/Toast';
import BottomNav from './components/BottomNav';
import FeedbackButton from './components/FeedbackButton';
import { fetchRecommendations } from './lib/api';
import { track } from './lib/firebase';
import {
  addIngredients,
  consumeIngredient,
  consumeIngredients,
  markAllNotificationsRead,
  markNotificationRead,
  saveRecipe,
  setFridgeType,
  setNotifyExpiry,
  subscribeFridgeType,
  subscribeHistory,
  subscribeIngredients,
  subscribeLikes,
  subscribeNotifications,
  subscribeNotifyExpiry,
  subscribeSavedRecipes,
  toggleLike as toggleLikeDoc,
  unsaveRecipe,
} from './lib/db';
import {
  daysLeft as calcDaysLeft,
  startOfMonth,
  type AppNotification,
  type ConsumeAction,
  type FridgeType,
  type HistoryEntry,
  type Ingredient,
  type IngredientVM,
  type NewIngredient,
  type RecommendedRecipe,
  type SavedRecipe,
  type SavedRecipeInput,
} from './types';
import FridgeEntryTransition from './components/FridgeEntryTransition';
import HomeView from './views/HomeView';
import LoginView from './views/LoginView';
import NotificationsView from './views/NotificationsView';
import ReceiptView from './views/ReceiptView';
import RecipeView from './views/RecipeView';
import RecipeDetailView from './views/RecipeDetailView';
import SavedView from './views/SavedView';
import SettingsView from './views/SettingsView';
import { PrivacyView, TermsView } from './views/LegalView';

/** 화면 전환마다 어떤 경로를 거쳤는지 남긴다. UT처럼 사용 흐름을 나중에 되짚어보기 위함. */
function useScreenViewTracking() {
  const location = useLocation();
  useEffect(() => {
    track('screen_view', { path: location.pathname });
  }, [location.pathname]);
}

const TAB_ROUTES = ['/', '/recipes', '/saved'];

/** 하단 탭바는 3개 탭 화면에서만 보인다. 조리법 상세·영수증·설정 등 서브 화면에서는 숨긴다. */
function useShowBottomNav(): boolean {
  const location = useLocation();
  return TAB_ROUTES.includes(location.pathname);
}

function SplashScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-20 h-20 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-outline-variant/30">
          <Refrigerator size={40} className="text-primary" />
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
  useScreenViewTracking();
  const showBottomNav = useShowBottomNav();

  /**
   * 로그인 직후 냉장고 문 열기 트랜지션을 보여주기 위한 상태.
   *
   * justLoggedInRef: 이번 세션에서 실제로 로그인 버튼을 눌렀는지 추적.
   *   - Firebase가 세션을 복원할 때(페이지 리로드) onAuthStateChanged가 user를
   *     바로 non-null로 내려주는데, 그 경우에는 트랜지션을 보여주면 안 된다.
   *   - 버튼을 직접 누른 경우에만 true가 된다.
   *
   * prevUserUidRef: undefined = 첫 렌더 이전, null = 비로그인, string = 로그인.
   */
  const justLoggedInRef = useRef(false);
  const prevUserUidRef = useRef<string | null | undefined>(undefined);
  const [showFridgeEntry, setShowFridgeEntry] = useState(false);

  useEffect(() => {
    // 첫 렌더: 현재 상태를 기준값으로 저장하고 종료 (트랜지션 미실행)
    if (prevUserUidRef.current === undefined) {
      prevUserUidRef.current = user?.uid ?? null;
      return;
    }
    const wasLoggedOut = !prevUserUidRef.current;
    const isNowLoggedIn = Boolean(user);
    if (wasLoggedOut && isNowLoggedIn && justLoggedInRef.current) {
      setShowFridgeEntry(true);
      justLoggedInRef.current = false;
    }
    prevUserUidRef.current = user?.uid ?? null;
  }, [user]);

  /** login을 직접 호출하기 전에 ref를 세운다. */
  const handleLogin = useCallback(async () => {
    justLoggedInRef.current = true;
    await login();
  }, [login]);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [notifyExpiry, setNotifyExpiryState] = useState(false);
  const [fridgeType, setFridgeTypeState] = useState<FridgeType>('standard');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // AI 추천 레시피 목록 캐시. /recipes를 떠났다 돌아와도 재생성하지 않고 그대로 보여준다 —
  // 다시 만들어야 할 때(카테고리 변경, 검색어, "다른 메뉴 추천받기")만 loadRecipes를 명시적으로 호출한다.
  const [recipes, setRecipes] = useState<RecommendedRecipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState<string | null>(null);
  const [recipesFetched, setRecipesFetched] = useState(false);

  useEffect(() => {
    if (!user) {
      setIngredients([]);
      setSavedRecipes([]);
      setLikedIds(new Set());
      setHistory([]);
      setNotifyExpiryState(false);
      setFridgeTypeState('standard');
      setNotifications([]);
      return;
    }
    const uid = user.uid;
    const unsubs = [
      subscribeIngredients(uid, setIngredients, (e) => console.error('재료 구독 실패:', e)),
      subscribeSavedRecipes(uid, setSavedRecipes, (e) => console.error('저장 레시피 구독 실패:', e)),
      subscribeLikes(uid, setLikedIds, (e) => console.error('좋아요 구독 실패:', e)),
      subscribeHistory(uid, startOfMonth(), setHistory, (e) => console.error('소진 기록 구독 실패:', e)),
      subscribeNotifyExpiry(uid, setNotifyExpiryState, (e) => console.error('알림 설정 구독 실패:', e)),
      subscribeFridgeType(uid, setFridgeTypeState, (e) => console.error('냉장고 타입 구독 실패:', e)),
      subscribeNotifications(uid, setNotifications, (e) => console.error('알림함 구독 실패:', e)),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user?.uid]);

  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

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

  /** 요리를 마쳤을 때: 쓴 재료를 한 번에 소진 처리한다. */
  const handleCooked = async (items: IngredientVM[]) => {
    if (!user) return;
    try {
      await consumeIngredients(user.uid, items, 'eaten');
      toast.success(
        items.length > 0 ? `잘 드셨어요! 재료 ${items.length}개를 정리했어요.` : '맛있게 드셨길 바라요!',
      );
    } catch (e) {
      console.error('요리 완료 처리 실패:', e);
      toast.error('재료 정리에 실패했어요. 잠시 후 다시 시도해주세요.');
      throw e;
    }
  };

  const handleToggleNotify = () => {
    if (!user) return;
    const next = !notifyExpiry;
    setNotifyExpiryState(next); // 낙관적 업데이트
    setNotifyExpiry(user.uid, next).catch((e) => {
      console.error('알림 설정 저장 실패:', e);
      setNotifyExpiryState(!next);
      toast.error('알림 설정 변경에 실패했어요. 잠시 후 다시 시도해주세요.');
    });
  };

  const handleSetFridgeType = (type: FridgeType) => {
    if (!user) return;
    setFridgeTypeState(type); // 낙관적 업데이트
    setFridgeType(user.uid, type).catch((e) => {
      console.error('냉장고 타입 저장 실패:', e);
      toast.error('설정 저장에 실패했어요. 잠시 후 다시 시도해주세요.');
    });
  };

  const handleMarkNotificationRead = (id: string) => {
    if (!user) return;
    markNotificationRead(user.uid, id).catch((e) => console.error('알림 읽음 처리 실패:', e));
  };

  const handleMarkAllNotificationsRead = () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    markAllNotificationsRead(user.uid, unreadIds).catch((e) => console.error('알림 일괄 읽음 처리 실패:', e));
  };

  const loadRecipes = useCallback(
    async (opts?: { exclude?: string[]; category?: string; prompt?: string }) => {
      setRecipesLoading(true);
      setRecipesError(null);
      try {
        const result = await fetchRecommendations({
          ingredients: ingredientVMs.map((i) => ({ name: i.name, category: i.category, daysLeft: i.daysLeft })),
          category: opts?.category && opts.category !== '전체' ? opts.category : undefined,
          prompt: opts?.prompt?.trim() || undefined,
          exclude: opts?.exclude,
        });
        setRecipes(result);
      } catch (e) {
        console.error('레시피 추천 실패:', e);
        setRecipesError(e instanceof Error ? e.message : '추천을 불러오지 못했어요.');
      } finally {
        setRecipesLoading(false);
        setRecipesFetched(true);
      }
    },
    [ingredientVMs],
  );

  /** /recipes에 처음 들어왔을 때만 부른다. 뒤로 갔다 다시 들어오는 건 "필요"가 아니라 캐시로 보여준다. */
  const ensureRecipesLoaded = useCallback(() => {
    if (!recipesFetched && !recipesLoading) void loadRecipes();
  }, [recipesFetched, recipesLoading, loadRecipes]);

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
          <Route path="*" element={<LoginView onLogin={handleLogin} error={authError} />} />
        ) : (
          <>
            <Route
              path="/"
              element={
                <HomeView
                  ingredients={ingredientVMs}
                  history={history}
                  photoURL={user.photoURL}
                  unreadNotifications={unreadNotifications}
                  recipes={recipes}
                  fridgeType={fridgeType}
                  onAdd={handleAddIngredient}
                  onConsume={handleConsume}
                />
              }
            />
            <Route
              path="/notifications"
              element={
                <NotificationsView
                  notifications={notifications}
                  onMarkRead={handleMarkNotificationRead}
                  onMarkAllRead={handleMarkAllNotificationsRead}
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
                  recipes={recipes}
                  loading={recipesLoading}
                  error={recipesError}
                  loadRecipes={loadRecipes}
                  ensureRecipesLoaded={ensureRecipesLoaded}
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
                  onCooked={handleCooked}
                />
              }
            />
            <Route path="/saved" element={<SavedView savedRecipes={savedRecipes} onToggleSave={toggleSave} />} />
            <Route
              path="/settings"
              element={
                <SettingsView
                  user={user}
                  onLogout={logout}
                  notifyExpiry={notifyExpiry}
                  onToggleNotify={handleToggleNotify}
                  fridgeType={fridgeType}
                  onSetFridgeType={handleSetFridgeType}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      {user && showBottomNav && <BottomNav />}
      {user && <FeedbackButton />}

      {/* 로그인 직후에만 노출되는 냉장고 문 열기 입장 트랜지션 */}
      {showFridgeEntry && (
        <FridgeEntryTransition onComplete={() => setShowFridgeEntry(false)} />
      )}
    </div>
  );
}
