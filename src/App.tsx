/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ShoppingBag, UserCircle, AlertCircle,
  X, Plus, CheckCircle, Camera, Utensils, Receipt, RefreshCw, Milk, Package, Leaf, Egg, Apple, Beef, Bookmark, LogOut
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { scanReceipt } from './lib/api';
import { fileToCompressedDataUrl } from './lib/image';
import {
  addIngredients,
  deleteIngredient,
  saveRecipe,
  subscribeIngredients,
  subscribeSavedRecipes,
  unsaveRecipe,
} from './lib/db';
import {
  daysLeft as calcDaysLeft,
  INGREDIENT_CATEGORIES,
  type Ingredient,
  type IngredientCategory,
  type IngredientVM,
  type NewIngredient,
  type SavedRecipe,
  type SavedRecipeInput,
} from './types';
import RecipeView from './views/RecipeView';
import SavedView from './views/SavedView';

const LoginView: React.FC<{ onLogin: () => Promise<void>; error: string | null }> = ({ onLogin, error }) => {
  const [pending, setPending] = useState(false);
  const handleLogin = async () => {
    setPending(true);
    try {
      await onLogin();
    } finally {
      setPending(false);
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-screen p-6"
    >
      <div className="bg-surface/70 backdrop-blur-md p-8 rounded-2xl shadow-lg border border-white/30 flex flex-col items-center w-full space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-24 h-24 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-outline-variant/30">
            <ShoppingBag size={48} className="text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-primary">냉털메이트</h1>
            <p className="text-on-surface-variant">영수증만 올리면, 오늘 뭐 먹을지 정해드려요</p>
          </div>
        </div>
        <div className="w-full space-y-3">
          <button
            onClick={handleLogin}
            disabled={pending}
            className="w-full h-14 bg-white border border-outline-variant hover:bg-surface-container-low transition-colors rounded-xl shadow-sm flex items-center justify-center space-x-3 disabled:opacity-60"
          >
            <span className="font-semibold">{pending ? '로그인 중...' : '구글 계정으로 시작하기'}</span>
          </button>
          {error && <p className="text-sm text-error text-center">{error}</p>}
        </div>
        <p className="text-xs text-outline">로그인하면 이용약관에 동의하는 것으로 간주됩니다</p>
      </div>
    </motion.div>
  );
};

const EmptyHome = ({ onUpload, onManualAdd }: { onUpload: () => void, onManualAdd: () => void }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-5 pb-32">
    <div className="w-full max-w-md flex flex-col items-center text-center space-y-8">
      <div className="w-48 h-48 bg-surface-container-high rounded-full flex items-center justify-center shadow-sm relative mb-4">
        <div className="absolute inset-0 bg-primary opacity-10 rounded-full blur-xl"></div>
        <ShoppingBag size={80} className="text-outline-variant" />
      </div>
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold text-on-surface">영수증을 올려<br/>재료를 등록해보세요</h2>
        <p className="text-outline">아직 등록된 식재료가 없어요.<br/>영수증으로 쉽고 빠르게 시작해보세요.</p>
      </div>
      <button 
        onClick={onUpload}
        className="mt-6 w-full h-14 bg-primary text-white rounded-xl font-semibold shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
      >
        <Receipt size={20} /> 영수증 올리기
      </button>
      <button onClick={onManualAdd} className="w-full h-14 bg-transparent border-2 border-primary text-primary rounded-xl font-semibold hover:bg-primary/5 transition-colors">
        직접 입력하기
      </button>
    </div>
  </div>
);

const ItemIcon = ({ category }: { category: string }) => {
  switch(category) {
    case '유제품': return <Milk size={20} />;
    case '콩류': return <Package size={20} />;
    case '채소류': return <Leaf size={20} />;
    case '육류': return <Beef size={20} />;
    case '기타': return <Egg size={20} />;
    case '과일': return <Apple size={20} />;
    default: return <Utensils size={20} />;
  }
}

const PopulatedHome = ({ ingredients, onUpload, onRecipe, onDelete, onManualAdd }: { ingredients: IngredientVM[], onUpload: () => void, onRecipe: () => void, onDelete: (id: string) => void, onManualAdd: () => void }) => {
  const [deleteTarget, setDeleteTarget] = React.useState<IngredientVM | null>(null);
  const [activeCategory, setActiveCategory] = React.useState<string>('전체');
  
  const categories = ['전체', ...Array.from(new Set(ingredients.map(i => i.category)))];
  const filteredIngredients = activeCategory === '전체' ? ingredients : ingredients.filter(i => i.category === activeCategory);
  const urgent = ingredients.filter(i => i.daysLeft <= 2).sort((a,b) => a.daysLeft - b.daysLeft);
  
  return (
    <div className="flex-1 px-5 py-6 space-y-8 pb-32 max-w-2xl mx-auto w-full">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-on-surface">
          <AlertCircle className="text-error" size={24} /> 곧 먹어야 해요
        </h2>
        <div className="flex overflow-x-auto gap-4 pb-4 -mx-5 px-5 snap-x" style={{ scrollbarWidth: 'none' }}>
          {urgent.map(item => (
            <div key={item.id} className={`snap-start flex-none w-48 bg-white shadow-sm rounded-2xl p-4 flex flex-col justify-between cursor-pointer ${item.daysLeft === 0 ? 'border-2 border-error' : ''}`}>
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
                <p className="text-sm text-on-surface-variant mt-1">{item.category}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl font-semibold">내 재료</h2>
          <button onClick={onManualAdd} className="text-sm text-primary font-semibold flex items-center gap-1">
            <Plus size={16} /> 직접 추가
          </button>
        </div>

        <div className="flex overflow-x-auto gap-2 pb-1 -mx-5 px-5 snap-x" style={{ scrollbarWidth: 'none' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
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

        <div className="space-y-3">
          {filteredIngredients.length === 0 ? (
            <div className="text-center py-8 text-outline">해당 카테고리의 재료가 없습니다.</div>
          ) : (
            filteredIngredients.map(item => (
            <div key={item.id} className="bg-white shadow-sm rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center">
                  <ItemIcon category={item.category} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{item.name}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${item.daysLeft <= 5 ? 'bg-surface-variant text-on-surface-variant' : 'bg-primary/10 text-primary'}`}>
                      D-{item.daysLeft}
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
              <button onClick={() => setDeleteTarget(item)} className="text-outline hover:text-error p-2">
                <X size={20} />
              </button>
            </div>
            )))
          }
        </div>
      </section>
      
      <div className="fixed bottom-0 left-0 w-full px-5 pb-6 pt-10 bg-gradient-to-t from-background via-background to-transparent z-40">
        <div className="flex gap-4 max-w-2xl mx-auto">
          <button onClick={onUpload} className="flex-1 h-14 rounded-2xl bg-secondary-container text-on-secondary-container font-semibold flex items-center justify-center gap-2 shadow-sm">
            <Camera size={20} /> 영수증 올리기
          </button>
          <button onClick={onRecipe} className="flex-1 h-14 rounded-2xl bg-primary text-white font-semibold flex items-center justify-center gap-2 shadow-sm">
            <Utensils size={20} /> 오늘 뭐 먹지?
          </button>
        </div>
      </div>

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-5 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-6"
            >
              <div className="space-y-2 text-center">
                <h3 className="text-xl font-bold text-on-surface">재료 삭제</h3>
                <p className="text-on-surface-variant">정말 <span className="font-semibold text-primary">{deleteTarget.name}</span>을(를) 삭제하시겠습니까?</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteTarget(null)} 
                  className="flex-1 h-12 rounded-xl bg-surface-container-high text-on-surface font-semibold hover:bg-surface-dim transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }} 
                  className="flex-1 h-12 rounded-xl bg-error text-white font-semibold hover:bg-error/90 transition-colors"
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const AddIngredientModal = ({ onClose, onAdd }: { onClose: () => void, onAdd: (item: NewIngredient) => Promise<void> }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<IngredientCategory>('채소류');
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd({ name: name.trim(), category, shelfLifeDays: days });
      onClose();
    } catch (e) {
      console.error('재료 추가 실패:', e);
      alert('재료 추가에 실패했어요. 잠시 후 다시 시도해주세요.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-5"
      >
        <h3 className="text-xl font-bold text-on-surface text-center">재료 직접 추가</h3>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-on-surface-variant">재료 이름</label>
            <input
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
            <label className="text-sm font-medium text-on-surface-variant">카테고리</label>
            <div className="flex flex-wrap gap-2">
              {INGREDIENT_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-full text-sm font-semibold transition-colors ${category === cat ? 'bg-primary text-white' : 'bg-white text-on-surface-variant border border-outline-variant'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-on-surface-variant">예상 보관일수 (일)</label>
            <input
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
};

type ReceiptItem = { id: string; name: string; days: number; category: IngredientCategory };

const ReceiptView = ({ onSave, onBack }: { onSave: (items: NewIngredient[]) => Promise<void>, onBack: () => void }) => {
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanning(true);
    setScanError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPreviewUrl(dataUrl);
      const scanned = await scanReceipt(dataUrl);
      if (scanned.length === 0) {
        setScanError('영수증에서 식재료를 찾지 못했어요. 다른 사진으로 시도해보세요.');
      }
      setItems(scanned.map((s, idx) => ({
        id: `${Date.now()}-${idx}`,
        name: s.name,
        category: s.category,
        days: s.shelfLifeDays,
      })));
    } catch (err) {
      console.error('영수증 인식 실패:', err);
      setScanError(err instanceof Error ? err.message : '영수증 인식에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setScanning(false);
    }
  };

  const updateItem = (id: string, patch: Partial<ReceiptItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(item => item.id !== id));

  const addEmptyItem = () => {
    setItems(prev => [...prev, { id: `${Date.now()}`, name: '', days: 7, category: '기타' }]);
  };

  const validItems = items.filter(i => i.name.trim().length > 0);

  const handleSave = async () => {
    if (saving || validItems.length === 0) return;
    setSaving(true);
    try {
      await onSave(validItems.map(i => ({ name: i.name.trim(), category: i.category, shelfLifeDays: i.days })));
    } catch (e) {
      console.error('재료 저장 실패:', e);
      alert('저장에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <header className="flex justify-between items-center p-5 sticky top-0 bg-surface z-50">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-surface-variant">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">영수증 등록</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 flex flex-col pb-32 overflow-y-auto max-w-md mx-auto w-full">
        <section className="px-5 py-8 bg-surface-container-low flex flex-col items-center justify-center rounded-b-2xl mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="w-full bg-primary text-white h-14 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-primary/90 disabled:opacity-60"
          >
            {scanning ? <RefreshCw size={24} className="animate-spin" /> : <Camera size={24} />}
            <span className="font-semibold text-lg">{scanning ? '인식 중...' : previewUrl ? '다른 영수증 올리기' : '영수증 올리기'}</span>
          </button>

          <div className="mt-6 w-3/4 aspect-[2/3] border-2 border-dashed border-outline-variant rounded-xl overflow-hidden bg-white flex items-center justify-center relative shadow-inner">
            {previewUrl ? (
              <img src={previewUrl} alt="업로드한 영수증" className={`w-full h-full object-cover ${scanning ? 'opacity-50' : ''}`} />
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <Receipt size={40} className="mb-2 text-outline" />
                <p className="text-sm font-medium text-outline">영수증 사진을 올리면<br />AI가 재료를 인식해요</p>
              </div>
            )}
            {scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60">
                <RefreshCw size={32} className="animate-spin text-primary mb-2" />
                <p className="text-sm font-semibold text-primary">재료를 인식하고 있어요...</p>
              </div>
            )}
          </div>
          {scanError && <p className="mt-4 text-sm text-error text-center">{scanError}</p>}
        </section>

        <section className="px-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">이렇게 인식했어요</h2>
            <span className="text-xs text-outline">(수정할 수 있어요)</span>
          </div>

          {items.length === 0 && !scanning ? (
            <p className="text-sm text-outline text-center py-6">아직 인식된 재료가 없어요.<br />영수증을 올리거나 직접 추가해보세요.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-xl p-3 flex items-center gap-2 shadow-sm border border-surface-variant">
                  <input
                    type="text"
                    value={item.name}
                    placeholder="재료 이름"
                    onChange={(e) => updateItem(item.id, { name: e.target.value })}
                    className="flex-1 min-w-0 bg-surface-container-low rounded-lg px-3 py-2 border-none focus:ring-1 focus:ring-primary outline-none"
                  />
                  <select
                    value={item.category}
                    onChange={(e) => updateItem(item.id, { category: e.target.value as IngredientCategory })}
                    className="text-xs bg-surface-container-low rounded-lg px-2 py-2.5 border-none outline-none"
                  >
                    {INGREDIENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <div className={`flex items-center px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${item.days <= 3 ? 'bg-error-container text-on-error-container' : item.days <= 7 ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
                    D-
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={item.days}
                      onChange={(e) => updateItem(item.id, { days: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-10 bg-transparent border-none outline-none text-xs font-bold"
                    />
                  </div>
                  <button onClick={() => removeItem(item.id)} className="p-1 text-outline-variant hover:text-error">
                    <X size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3">
            <button onClick={addEmptyItem} className="w-full flex items-center justify-center gap-1 py-4 text-primary font-semibold rounded-xl border-2 border-dashed border-primary bg-white hover:bg-primary/5">
              <Plus size={20} /> 직접 추가
            </button>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 w-full max-w-md mx-auto md:left-1/2 md:-translate-x-1/2 bg-surface/90 backdrop-blur-md p-5 border-t border-surface-variant z-40">
        <button onClick={handleSave} disabled={saving || scanning || validItems.length === 0} className="w-full bg-primary text-white h-14 rounded-xl font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60">
          <CheckCircle size={20} /> {saving ? '저장 중...' : '이대로 저장하기'}
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const { user, loading: authLoading, error: authError, login, logout } = useAuth();
  const [view, setView] = useState<'home'|'receipt'|'recipe'|'saved'>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);

  useEffect(() => {
    if (!user) {
      setIngredients([]);
      setSavedRecipes([]);
      return;
    }
    const unsubIngredients = subscribeIngredients(user.uid, setIngredients, (e) => console.error('재료 구독 실패:', e));
    const unsubSaved = subscribeSavedRecipes(user.uid, setSavedRecipes, (e) => console.error('저장 레시피 구독 실패:', e));
    return () => {
      unsubIngredients();
      unsubSaved();
    };
  }, [user?.uid]);

  const ingredientVMs: IngredientVM[] = ingredients.map(i => ({ ...i, daysLeft: calcDaysLeft(i.expiresAt) }));
  const savedTitles = new Set(savedRecipes.map(r => r.title));

  const toggleSave = (recipe: SavedRecipeInput, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const action = savedTitles.has(recipe.title)
      ? unsaveRecipe(user.uid, recipe.title)
      : saveRecipe(user.uid, recipe);
    action.catch((err) => {
      console.error('레시피 저장/해제 실패:', err);
      alert('처리에 실패했어요. 잠시 후 다시 시도해주세요.');
    });
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    setView('home');
    await logout();
  };

  const handleSaveReceipt = async (items: NewIngredient[]) => {
    if (!user) return;
    await addIngredients(user.uid, items);
    setView('home');
  };

  const handleAddIngredient = async (item: NewIngredient) => {
    if (!user) return;
    await addIngredients(user.uid, [item]);
  };

  const handleDeleteIngredient = (id: string) => {
    if (!user) return;
    deleteIngredient(user.uid, id).catch((e) => {
      console.error('재료 삭제 실패:', e);
      alert('삭제에 실패했어요. 잠시 후 다시 시도해주세요.');
    });
  };

  if (authLoading) {
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

  return (
    <div className="min-h-screen bg-background text-on-background font-sans overflow-x-hidden">
      <AnimatePresence mode="wait">
        {!user && (
          <LoginView key="login" onLogin={login} error={authError} />
        )}
        {user && view === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col min-h-screen"
          >
            <header className="flex justify-between items-center p-5 sticky top-0 bg-surface z-50 shadow-sm max-w-2xl mx-auto w-full">
              <div className="text-2xl font-bold text-primary">냉털메이트</div>
              <div className="relative">
                <button onClick={() => setMenuOpen(o => !o)} className="text-on-surface-variant hover:text-primary transition-colors flex items-center">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="프로필" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-outline-variant" />
                  ) : (
                    <UserCircle size={28} />
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-surface-variant py-2 z-[70]">
                    <div className="px-4 py-2 text-sm text-on-surface-variant border-b border-surface-variant truncate">
                      {user?.displayName ?? user?.email}
                    </div>
                    <button onClick={() => { setMenuOpen(false); setView('saved'); }} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-surface-container-low flex items-center gap-2">
                      <Bookmark size={16} /> 저장한 레시피
                    </button>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm font-medium text-error hover:bg-surface-container-low flex items-center gap-2">
                      <LogOut size={16} /> 로그아웃
                    </button>
                  </div>
                )}
              </div>
            </header>
            
            {ingredientVMs.length === 0 ? (
              <EmptyHome onUpload={() => setView('receipt')} onManualAdd={() => setShowAddModal(true)} />
            ) : (
              <PopulatedHome
                ingredients={ingredientVMs}
                onUpload={() => setView('receipt')}
                onRecipe={() => setView('recipe')}
                onDelete={handleDeleteIngredient}
                onManualAdd={() => setShowAddModal(true)}
              />
            )}
          </motion.div>
        )}
        {user && view === 'receipt' && (
          <motion.div
            key="receipt"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="flex-1 w-full"
          >
             <ReceiptView onSave={handleSaveReceipt} onBack={() => setView('home')} />
          </motion.div>
        )}
        {user && view === 'recipe' && (
          <motion.div
            key="recipe"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 w-full"
          >
             <RecipeView onBack={() => setView('home')} ingredients={ingredientVMs} savedTitles={savedTitles} onToggleSave={toggleSave} />
          </motion.div>
        )}
        {user && view === 'saved' && (
          <motion.div
            key="saved"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 w-full"
          >
             <SavedView onBack={() => setView('home')} savedRecipes={savedRecipes} onToggleSave={toggleSave} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {user && showAddModal && (
          <AddIngredientModal onClose={() => setShowAddModal(false)} onAdd={handleAddIngredient} />
        )}
      </AnimatePresence>
    </div>
  );
}

