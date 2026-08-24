import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle, Camera, ChevronRight, LayoutGrid, List, Plus,
  Refrigerator, Search, Settings, ShoppingBag, Trash2, Utensils, UtensilsCrossed, Wand2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ItemIcon } from '../components/ItemIcon';
import NotificationBell from '../components/NotificationBell';
import VirtualFridge from '../components/VirtualFridge';
import { recipePath } from '../lib/paths';
import {
  INGREDIENT_CATEGORIES,
  summarize,
  type ConsumeAction,
  type FridgeType,
  type HistoryEntry,
  type IngredientCategory,
  type IngredientVM,
  type NewIngredient,
  type RecommendedRecipe,
} from '../types';

/** 유통기한 임박도를 배지 색으로 한눈에 보여준다: 안전(초록)/경고(주황)/긴급(빨강). */
function freshnessBadge(daysLeft: number): { label: string; className: string } {
  if (daysLeft <= 2) return { label: '긴급', className: 'bg-error text-white' };
  if (daysLeft <= 5) return { label: '경고', className: 'bg-tertiary-container text-on-tertiary-container' };
  return { label: '안전', className: 'bg-primary-container/40 text-on-primary-container' };
}

/* ---------------- 소진 처리 시트 ---------------- */

function ConsumeSheet({
  item,
  onClose,
  onConsume,
}: {
  item: IngredientVM;
  onClose: () => void;
  onConsume: (action: ConsumeAction) => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 shadow-xl flex flex-col gap-5"
      >
        <div className="space-y-1 text-center">
          <h3 className="text-xl font-bold text-on-surface">{item.name}</h3>
          <p className="text-sm text-on-surface-variant">어떻게 정리할까요?</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => onConsume('eaten')}
            className="w-full h-14 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <UtensilsCrossed size={20} /> 다 먹었어요
          </button>
          <button
            onClick={() => onConsume('discarded')}
            className="w-full h-14 rounded-xl bg-error-container text-on-error-container font-semibold flex items-center justify-center gap-2 hover:bg-error-container/80 transition-colors"
          >
            <Trash2 size={20} /> 버렸어요
          </button>
          <button onClick={onClose} className="w-full h-12 rounded-xl text-on-surface-variant font-medium hover:bg-surface-container-high transition-colors">
            취소
          </button>
        </div>

        <p className="text-xs text-outline text-center">
          기록해두면 이번 달에 얼마나 잘 챙겨 먹었는지 알려드려요.
        </p>
      </motion.div>
    </div>
  );
}

/* ---------------- 직접 추가 모달 ---------------- */

function AddIngredientModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: NewIngredient) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1개');
  const [category, setCategory] = useState<IngredientCategory>('채소류');
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd({ name: name.trim(), category, quantity: quantity.trim() || '1개', shelfLifeDays: days });
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-xl font-bold text-on-surface text-center">재료 직접 추가</h3>
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="ing-name" className="text-sm font-medium text-on-surface-variant">재료 이름</label>
            <input
              id="ing-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="예: 애호박"
              autoFocus
              className="w-full h-12 bg-white rounded-xl px-4 border border-outline-variant focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ing-qty" className="text-sm font-medium text-on-surface-variant">수량</label>
            <input
              id="ing-qty"
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="예: 2개, 500g, 1팩"
              className="w-full h-12 bg-white rounded-xl px-4 border border-outline-variant focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium text-on-surface-variant">카테고리</span>
            <div className="flex flex-wrap gap-2">
              {INGREDIENT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  aria-pressed={category === cat}
                  className={`px-3 py-2 rounded-full text-sm font-semibold transition-colors ${category === cat ? 'bg-primary text-white' : 'bg-white text-on-surface-variant border border-outline-variant'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="ing-days" className="text-sm font-medium text-on-surface-variant">예상 보관일수 (일)</label>
            <input
              id="ing-days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              className="w-full h-12 bg-white rounded-xl px-4 border border-outline-variant focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl bg-surface-container-high text-on-surface font-semibold hover:bg-surface-dim transition-colors">
            취소
          </button>
          <button onClick={submit} disabled={!name.trim() || saving} className="flex-1 h-12 rounded-xl bg-primary text-white font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {saving ? '추가 중...' : '추가하기'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------- 절약 리포트 ---------------- */

function SavingsCard({ history }: { history: HistoryEntry[] }) {
  const { eaten, discarded, rate } = summarize(history);
  if (eaten + discarded === 0) return null;

  return (
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-surface-variant space-y-3">
      <h2 className="text-sm font-semibold text-on-surface-variant">이번 달 성적표</h2>
      <p className="text-lg leading-relaxed">
        <span className="font-bold text-primary text-2xl">{eaten}개</span>를 챙겨 먹었고,{' '}
        <span className={`font-bold ${discarded > 0 ? 'text-error' : 'text-on-surface-variant'}`}>{discarded}개</span>를 버렸어요.
      </p>
      <div className="h-2 w-full bg-surface-variant rounded-full overflow-hidden" role="img" aria-label={`소진율 ${Math.round(rate * 100)}퍼센트`}>
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.round(rate * 100)}%` }} />
      </div>
      <p className="text-xs text-outline">
        소진율 {Math.round(rate * 100)}%
        {rate >= 0.7 ? ' — 훌륭해요! 낭비가 거의 없네요.' : ' — 임박한 재료부터 써볼까요?'}
      </p>
    </section>
  );
}

/* ---------------- 빈 상태 ---------------- */

function EmptyHome({ onManualAdd }: { onManualAdd: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-5 pb-32">
      <div className="w-full max-w-md flex flex-col items-center text-center space-y-8">
        <div className="w-48 h-48 bg-surface-container-high rounded-full flex items-center justify-center shadow-sm relative mb-4">
          <div className="absolute inset-0 bg-primary opacity-10 rounded-full blur-xl" />
          <ShoppingBag size={80} className="text-outline-variant" />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-on-surface">영수증을 올려<br />재료를 등록해보세요</h2>
          <p className="text-outline">아직 등록된 식재료가 없어요.<br />영수증으로 쉽고 빠르게 시작해보세요.</p>
        </div>
        <Link
          to="/receipt"
          className="mt-6 w-full h-14 bg-primary text-white rounded-xl font-semibold shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          <Camera size={20} /> 영수증 올리기
        </Link>
        <button onClick={onManualAdd} className="w-full h-14 bg-transparent border-2 border-primary text-primary rounded-xl font-semibold hover:bg-primary/5 transition-colors">
          직접 입력하기
        </button>
      </div>
    </div>
  );
}

/* ---------------- 홈 ---------------- */

export default function HomeView({
  ingredients,
  history,
  photoURL,
  unreadNotifications,
  recipes,
  fridgeType,
  onAdd,
  onConsume,
}: {
  ingredients: IngredientVM[];
  history: HistoryEntry[];
  photoURL: string | null;
  unreadNotifications: number;
  recipes: RecommendedRecipe[];
  fridgeType: FridgeType;
  onAdd: (item: NewIngredient) => Promise<void>;
  onConsume: (item: IngredientVM, action: ConsumeAction) => void;
}) {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [consumeTarget, setConsumeTarget] = useState<IngredientVM | null>(null);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [search, setSearch] = useState('');
  const [urgentIndex, setUrgentIndex] = useState(0);
  const urgentTrackRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'list' | 'fridge'>('list');
  const [selectedForRecipe, setSelectedForRecipe] = useState<Set<string>>(new Set());

  const toggleSelectForRecipe = (id: string) =>
    setSelectedForRecipe((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const goRecipeWithSelection = () => {
    const names = ingredients.filter((i) => selectedForRecipe.has(i.id)).map((i) => i.name);
    if (names.length === 0) return;
    navigate(`/recipes?prompt=${encodeURIComponent(names.join(', ') + '로 만들 수 있는 요리 위주로')}`);
  };

  /** 카드 하나 폭(w-48=192px) + 간격(gap-4=16px) 기준으로 지금 몇 번째가 보이는지 추정한다. */
  const handleUrgentScroll = () => {
    const el = urgentTrackRef.current;
    if (!el) return;
    const step = 208;
    setUrgentIndex(Math.round(el.scrollLeft / step));
  };

  const categories = useMemo(
    () => ['전체', ...Array.from(new Set(ingredients.map((i) => i.category)))],
    [ingredients],
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return ingredients.filter(
      (i) =>
        (activeCategory === '전체' || i.category === activeCategory) &&
        (keyword === '' || i.name.toLowerCase().includes(keyword)),
    );
  }, [ingredients, activeCategory, search]);

  const urgent = useMemo(
    () => ingredients.filter((i) => i.daysLeft <= 2).sort((a, b) => a.daysLeft - b.daysLeft),
    [ingredients],
  );

  const header = (
    <header className="flex justify-between items-center p-5 sticky top-0 bg-surface z-50 shadow-sm max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-2 text-2xl font-bold text-primary">
        <Refrigerator size={22} className="shrink-0" aria-hidden />
        냉털메이트
      </div>
      <div className="flex items-center gap-4">
        <NotificationBell unreadCount={unreadNotifications} />
        <Link to="/settings" aria-label="설정" className="text-on-surface-variant hover:text-primary transition-colors flex items-center">
          {photoURL ? (
            <img src={photoURL} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-outline-variant" />
          ) : (
            <Settings size={26} />
          )}
        </Link>
      </div>
    </header>
  );

  if (ingredients.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        {header}
        <EmptyHome onManualAdd={() => setShowAddModal(true)} />
        <AnimatePresence>
          {showAddModal && <AddIngredientModal onClose={() => setShowAddModal(false)} onAdd={onAdd} />}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {header}

      <div className="flex-1 px-5 py-6 space-y-8 pb-48 max-w-2xl mx-auto w-full">
        <SavingsCard history={history} />

        {urgent.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-on-surface">
              <AlertCircle className="text-error" size={24} /> 곧 먹어야 해요
            </h2>
            <div
              ref={urgentTrackRef}
              onScroll={handleUrgentScroll}
              className="flex overflow-x-auto gap-4 pb-4 -mx-5 px-5 snap-x snap-mandatory scrollbar-hide"
            >
              {urgent.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setConsumeTarget(item)}
                  className={`snap-start flex-none w-48 text-left bg-white shadow-sm rounded-2xl p-4 flex flex-col justify-between ${item.daysLeft === 0 ? 'border-2 border-error' : ''}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-full bg-surface-variant flex items-center justify-center">
                      <ItemIcon category={item.category} />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.daysLeft === 0 ? 'bg-error-container text-on-error-container animate-pulse' : item.daysLeft === 1 ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-error text-white'}`}>
                      D-{item.daysLeft}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{item.name}</h3>
                    <p className="text-sm text-on-surface-variant mt-1">
                      {item.quantity ? `${item.quantity} · ` : ''}{item.category}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {urgent.length > 1 && (
              <div className="flex justify-center gap-1.5" aria-hidden="true">
                {urgent.map((item, i) => (
                  <span
                    key={item.id}
                    className={`h-1.5 rounded-full transition-all ${i === urgentIndex ? 'w-4 bg-primary' : 'w-1.5 bg-outline-variant'}`}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {recipes.length > 0 && (
          <section className="space-y-4">
            <div className="flex justify-between items-end">
              <h2 className="text-xl font-semibold">오늘의 추천 레시피</h2>
              <Link to="/recipes" className="text-sm text-primary font-semibold flex items-center gap-0.5">
                전체보기 <ChevronRight size={16} />
              </Link>
            </div>
            <div className="space-y-3">
              {recipes.slice(0, 2).map((recipe) => (
                <Link
                  key={recipe.title}
                  to={recipePath(recipe.title)}
                  className="bg-white shadow-sm rounded-2xl p-4 flex items-center justify-between gap-3 hover:shadow-md transition-shadow"
                >
                  <div className="min-w-0">
                    <h4 className="font-semibold truncate">{recipe.title}</h4>
                    <p className="text-sm text-on-surface-variant mt-1">
                      ⏱️ {recipe.time} · 🔥 {recipe.difficulty}
                      {recipe.missingIngredients.length === 0 && (
                        <span className="text-primary font-semibold"> · 바로 만들 수 있어요</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight size={20} className="shrink-0 text-outline" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex justify-between items-end">
            <h2 className="text-xl font-semibold">내 재료 <span className="text-base text-outline font-normal">{ingredients.length}개</span></h2>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-outline-variant overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  aria-label="리스트로 보기"
                  className={`p-1.5 ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-white text-on-surface-variant'}`}
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode('fridge')}
                  aria-pressed={viewMode === 'fridge'}
                  aria-label="냉장고로 보기"
                  className={`p-1.5 ${viewMode === 'fridge' ? 'bg-primary text-white' : 'bg-white text-on-surface-variant'}`}
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
              <button onClick={() => setShowAddModal(true)} className="text-sm text-primary font-semibold flex items-center gap-1">
                <Plus size={16} /> 직접 추가
              </button>
            </div>
          </div>

          {ingredients.length >= 8 && (
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="재료 검색"
                aria-label="재료 검색"
                className="w-full h-12 bg-white rounded-xl pl-11 pr-4 border border-outline-variant focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          )}

          <div className="flex overflow-x-auto gap-2 pb-1 -mx-5 px-5 snap-x scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                aria-pressed={activeCategory === cat}
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

          {filtered.length === 0 ? (
            <div className="text-center py-8 text-outline">
              {search.trim() ? `"${search.trim()}"에 해당하는 재료가 없어요.` : '해당 카테고리의 재료가 없습니다.'}
            </div>
          ) : viewMode === 'fridge' ? (
            <div className="space-y-3">
              <VirtualFridge
                type={fridgeType}
                items={filtered}
                selected={selectedForRecipe}
                onToggleSelect={toggleSelectForRecipe}
              />
              {selectedForRecipe.size > 0 && (
                <button
                  onClick={goRecipeWithSelection}
                  className="w-full h-12 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 shadow-sm hover:bg-primary/90 transition-colors"
                >
                  <Wand2 size={18} /> 선택한 {selectedForRecipe.size}개로 추천받기
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => {
                const badge = freshnessBadge(item.daysLeft);
                return (
                <div key={item.id} className="bg-white shadow-sm rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center">
                      <ItemIcon category={item.category} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium truncate">{item.name}</h4>
                        {item.quantity && <span className="text-xs text-on-surface-variant">{item.quantity}</span>}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
                          {badge.label} D-{item.daysLeft}
                        </span>
                      </div>
                      <div className="w-32 h-2 bg-surface-variant rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.daysLeft <= 2 ? 'bg-error' : item.daysLeft <= 5 ? 'bg-tertiary-container' : 'bg-primary'}`}
                          style={{ width: `${Math.max(10, Math.min(100, ((14 - item.daysLeft) / 14) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setConsumeTarget(item)}
                    aria-label={`${item.name} 정리하기`}
                    className="shrink-0 px-3 h-9 rounded-lg text-sm font-semibold text-on-surface-variant bg-surface-container-high hover:bg-surface-dim transition-colors"
                  >
                    정리
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="fixed bottom-16 left-0 w-full px-5 pb-2 pt-10 bg-gradient-to-t from-background via-background to-transparent z-40">
        <div className="flex gap-4 max-w-2xl mx-auto">
          <Link to="/receipt" className="flex-1 h-14 rounded-2xl bg-secondary-container text-on-secondary-container font-semibold flex items-center justify-center gap-2 shadow-sm">
            <Camera size={20} /> 영수증 올리기
          </Link>
          <button onClick={() => navigate('/recipes')} className="flex-1 h-14 rounded-2xl bg-primary text-white font-semibold flex items-center justify-center gap-2 shadow-sm">
            <Utensils size={20} /> 오늘 뭐 먹지?
          </button>
        </div>
      </div>

      <AnimatePresence>
        {consumeTarget && (
          <ConsumeSheet
            item={consumeTarget}
            onClose={() => setConsumeTarget(null)}
            onConsume={(action) => {
              onConsume(consumeTarget, action);
              setConsumeTarget(null);
            }}
          />
        )}
        {showAddModal && <AddIngredientModal onClose={() => setShowAddModal(false)} onAdd={onAdd} />}
      </AnimatePresence>
    </div>
  );
}
