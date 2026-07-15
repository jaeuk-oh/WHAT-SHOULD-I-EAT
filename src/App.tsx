/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ShoppingBag, UserCircle, AlertCircle, AlertTriangle,
  X, Plus, CheckCircle, Camera, Utensils, Receipt, ChefHat, RefreshCw, Info, Milk, Package, Leaf, Egg, Apple, Send, Wand2, Beef, Mic, Bookmark, LogOut
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';

interface Ingredient {
  id: string;
  name: string;
  category: string;
  daysLeft: number;
}

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

const EmptyHome = ({ onUpload }: { onUpload: () => void }) => (
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
      <button className="w-full h-14 bg-transparent border-2 border-primary text-primary rounded-xl font-semibold hover:bg-primary/5 transition-colors">
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

const PopulatedHome = ({ ingredients, onUpload, onRecipe, onDelete }: { ingredients: Ingredient[], onUpload: () => void, onRecipe: () => void, onDelete: (id: string) => void }) => {
  const [deleteTarget, setDeleteTarget] = React.useState<Ingredient | null>(null);
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
          <span className="text-sm text-on-surface-variant cursor-pointer">전체보기</span>
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

const ReceiptView = ({ onSave, onBack }: { onSave: () => void, onBack: () => void }) => {
  const [items, setItems] = useState([
    { id: '1', name: '서울우유 1L', days: 7 },
    { id: '2', name: '국산콩 두부 300g', days: 14 },
    { id: '3', name: '리코타 치즈 샐러드', days: 3 },
    { id: '4', name: '무항생제 계란 15구', days: 21 },
  ]);
  const [isListening, setIsListening] = useState(false);

  const handleVoiceInput = () => {
    setIsListening(true);
    setTimeout(() => {
      setItems([...items, { id: Date.now().toString(), name: '당근 1개', days: 10 }]);
      setIsListening(false);
    }, 2000);
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
          <button className="w-full bg-primary text-white h-14 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-primary/90">
            <Receipt size={24} />
            <span className="font-semibold text-lg">영수증 올리기</span>
          </button>
          
          <div className="mt-6 w-3/4 aspect-[2/3] border-2 border-dashed border-outline-variant rounded-xl overflow-hidden bg-white flex items-center justify-center relative shadow-inner">
             <img src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80" alt="Receipt Preview" className="w-full h-full object-cover opacity-60 grayscale" />
             <div className="absolute inset-0 flex flex-col items-center justify-center">
               <Receipt size={40} className="mb-2 text-outline" />
               <p className="text-sm font-medium text-outline">최근 등록된 영수증</p>
             </div>
          </div>
        </section>

        <section className="px-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">이렇게 인식했어요</h2>
            <span className="text-xs text-outline">(수정할 수 있어요)</span>
          </div>

          <div className="flex flex-col gap-3">
            {items.map((item, idx) => (
              <div key={item.id} className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm border border-surface-variant">
                <div className="flex-1">
                  <input 
                    type="text" 
                    value={item.name} 
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx].name = e.target.value;
                      setItems(newItems);
                    }}
                    className="w-full bg-surface-container-low rounded-lg px-3 py-2 border-none focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${item.days <= 3 ? 'bg-error-container text-on-error-container' : item.days <= 7 ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
                  D-{item.days}
                </div>
                <button className="p-1 text-outline-variant hover:text-error">
                  <X size={20} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-1 py-4 text-primary font-semibold rounded-xl border-2 border-dashed border-primary bg-white hover:bg-primary/5">
              <Plus size={20} /> 직접 추가
            </button>
            <button onClick={handleVoiceInput} className="flex-1 flex items-center justify-center gap-1 py-4 text-primary font-semibold rounded-xl border-2 border-dashed border-primary bg-white hover:bg-primary/5">
              {isListening ? (
                <span className="animate-pulse flex items-center gap-1"><Mic size={20} /> 듣는 중...</span>
              ) : (
                <span className="flex items-center gap-1"><Mic size={20} /> 음성 추가</span>
              )}
            </button>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 w-full max-w-md mx-auto md:left-1/2 md:-translate-x-1/2 bg-surface/90 backdrop-blur-md p-5 border-t border-surface-variant z-40">
        <button onClick={onSave} className="w-full bg-primary text-white h-14 rounded-xl font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-primary/90">
          <CheckCircle size={20} /> 이대로 저장하기
        </button>
      </div>
    </div>
  );
};

const categories = ['전체', '다이어트', '간단한', '자극적인', '비건'];

const allRecipes = [
  {
    id: 1,
    title: '애호박 두부 볶음',
    time: '15분',
    difficulty: '쉬움',
    warning: '이 재료 곧 상해요 (애호박, 두부)',
    warningType: 'alert',
    tags: ['애호박', '두부', '양파'],
    category: ['간단한', '비건', '다이어트'],
    substitutes: [{ missing: '양파', replaceWith: '대파' }]
  },
  {
    id: 2,
    title: '얼큰 두부 전골',
    time: '25분',
    difficulty: '보통',
    warning: '유통기한 임박! 두부를 써보세요',
    warningType: 'alert',
    tags: ['두부', '대파', '버섯', '차돌박이'],
    category: ['자극적인'],
    substitutes: [{ missing: '차돌박이', replaceWith: '돼지고기 앞다리살' }]
  },
  {
    id: 3,
    title: '계란 사과 샐러드',
    time: '10분',
    difficulty: '아주 쉬움',
    warning: '신선할 때 드세요',
    warningType: 'info',
    tags: ['계란', '사과', '마요네즈'],
    category: ['다이어트', '간단한']
  },
  {
    id: 4,
    title: '매콤 불닭 볶음면',
    time: '10분',
    difficulty: '쉬움',
    warning: '스트레스 풀리는 맛!',
    warningType: 'info',
    tags: ['불닭소스', '소면', '청양고추'],
    category: ['자극적인', '간단한']
  },
  {
    id: 5,
    title: '닭가슴살 고구마 오븐구이',
    time: '30분',
    difficulty: '보통',
    warning: '다이어터 필수 식단',
    warningType: 'info',
    tags: ['닭가슴살', '고구마', '마늘'],
    category: ['다이어트']
  },
];

const communityRecipes = [
  { id: 101, title: '자취생 10분컷 참치마요 덮밥', author: '요리왕비룡', likes: 1245, rank: 1, tags: ['자취', '초간단'] },
  { id: 102, title: '식단러의 눈물젖은 오트밀죽', author: '다이어터', likes: 890, rank: 2, tags: ['다이어트', '오트밀'] },
  { id: 103, title: '할머니 비밀 레시피, 돼지갈비찜', author: '한식러버', likes: 756, rank: 3, tags: ['돼지고기', '전통'] },
  { id: 104, title: '남은 치킨 200% 활용 볶음밥', author: '치느님', likes: 432, rank: 4, tags: ['활용', '치킨'] },
];

const celebRecipes = [
  { id: 201, title: '어남선생 류수영의 평생 짜장면', author: '류수영', likes: 5430, tags: ['셀럽', '면요리'] },
  { id: 202, title: '백종원의 만능 양파 볶음', author: '백종원', likes: 4321, tags: ['쉐프', '만능'] },
  { id: 203, title: '성시경 텐동 만들기', author: '성시경', likes: 3210, tags: ['먹을텐데', '튀김'] },
];

const RecipeView = ({ onBack, savedRecipes, toggleSave }: { onBack: () => void, savedRecipes: number[], toggleSave: (id: number, e: React.MouseEvent) => void }) => {
  const [currentTab, setCurrentTab] = useState<'맞춤추천' | '커뮤니티' | '셀럽/쉐프'>('맞춤추천');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [aiPrompt, setAiPrompt] = useState('');

  // If AI prompt is entered, just show recipes that somewhat match (simple mock logic) or all if empty
  let displayRecipes = activeCategory === '전체' 
    ? allRecipes 
    : allRecipes.filter(r => r.category.includes(activeCategory));
    
  if (aiPrompt.includes('자극')) {
    displayRecipes = allRecipes.filter(r => r.category.includes('자극적인'));
  } else if (aiPrompt.includes('다이어트') || aiPrompt.includes('살')) {
    displayRecipes = allRecipes.filter(r => r.category.includes('다이어트'));
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <div className="w-full max-w-md mx-auto bg-surface min-h-screen relative">
        <header className="flex justify-between items-center p-5 sticky top-0 bg-surface z-50">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-surface-variant">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">오늘 뭐 먹지?</h1>
          <div className="w-10"></div>
        </header>

        <div className="flex px-5 pt-2 pb-0 border-b border-surface-variant sticky top-[72px] bg-surface z-40">
          {(['맞춤추천', '커뮤니티', '셀럽/쉐프'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setCurrentTab(tab)}
              className={`flex-1 pb-3 text-center font-semibold text-sm relative ${currentTab === tab ? 'text-primary' : 'text-on-surface-variant'}`}
            >
              {tab}
              {currentTab === tab && <motion.div layoutId="tabIndicator" className="absolute bottom-0 left-0 w-full h-[3px] bg-primary rounded-t-full" />}
            </button>
          ))}
        </div>

        <main className="flex-1 flex flex-col px-5 py-6 gap-6 pb-32">
          {currentTab === '맞춤추천' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
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

              <div className="bg-white rounded-2xl p-2 shadow-sm border border-outline-variant flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wand2 size={20} className="text-primary" />
                </div>
                <input 
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="오늘은 자극적인게 땡겨"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm outline-none"
                />
                <button className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors">
                  <Send size={18} />
                </button>
              </div>

              <section className="bg-primary-container/20 rounded-xl p-6 flex items-start gap-4 border border-primary-container/30 mt-2">
                <div className="text-4xl"><ChefHat size={40} className="text-primary"/></div>
                <div>
                  <p className="text-lg leading-relaxed text-on-surface">
                    냉장고 살펴봤어요! <br/>
                    <span className="font-bold text-primary">곧 상하는 애호박·두부</span>부터 쓸게요.
                  </p>
                </div>
              </section>

              <section className="flex flex-col gap-4">
                {displayRecipes.map(recipe => (
                  <article key={recipe.id} className="bg-white rounded-xl p-5 shadow-sm border border-surface-variant flex flex-col gap-3 cursor-pointer hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-2">
                        <h2 className="text-xl font-semibold">{recipe.title}</h2>
                        <div className="flex gap-2 mt-1">
                          <span className="bg-surface-container-high px-2 py-1 rounded-full text-xs flex items-center gap-1">⏱️ {recipe.time}</span>
                          <span className="bg-surface-container-high px-2 py-1 rounded-full text-xs flex items-center gap-1">🔥 {recipe.difficulty}</span>
                        </div>
                      </div>
                      <button onClick={(e) => toggleSave(recipe.id, e)} className="p-1 -mt-1 -mr-1 text-outline hover:text-primary transition-colors shrink-0">
                        <Bookmark size={24} className={savedRecipes.includes(recipe.id) ? "fill-primary text-primary" : ""} />
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-tertiary-container flex items-center gap-1">
                      {recipe.warningType === 'alert' ? <AlertTriangle size={16} /> : <Info size={16} />} 
                      {recipe.warning}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {recipe.tags.map((tag, idx) => (
                        <span key={idx} className={`px-3 py-1 rounded-full text-xs ${idx < 2 ? 'bg-primary-container/30 text-primary-fixed-variant border border-primary-container/50' : 'bg-surface-container-high text-on-surface-variant'}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    {recipe.substitutes && recipe.substitutes.length > 0 && (
                      <div className="mt-2 p-3 bg-surface-container-low rounded-lg border border-surface-variant flex flex-col gap-1">
                        <span className="text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                          <RefreshCw size={14} /> 대체 식재료 추천
                        </span>
                        {recipe.substitutes.map((sub, idx) => (
                          <span key={idx} className="text-sm text-on-surface">
                            <span className="line-through text-outline">{sub.missing}</span> 대신 <b className="text-primary">{sub.replaceWith}</b>
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </section>
            </motion.div>
          )}

          {currentTab === '커뮤니티' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold">이번 주 인기 랭킹 🏆</h2>
                <button className="text-sm text-primary font-semibold">내 레시피 올리기</button>
              </div>
              
              {communityRecipes.map(recipe => (
                <article key={recipe.id} className="bg-white rounded-xl p-5 shadow-sm border border-surface-variant flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 z-10 ${recipe.rank <= 3 ? 'bg-tertiary text-white shadow-md' : 'bg-surface-variant text-on-surface-variant'}`}>
                    {recipe.rank}
                  </div>
                  <div className="flex-1 z-10 pr-2">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-bold text-on-surface leading-tight mb-1">{recipe.title}</h3>
                      <button onClick={(e) => toggleSave(recipe.id, e)} className={`p-1 -mt-1 -mr-1 transition-colors ${savedRecipes.includes(recipe.id) ? 'text-primary' : 'text-outline hover:text-primary'}`}>
                        <Bookmark size={20} className={savedRecipes.includes(recipe.id) ? "fill-primary" : ""} />
                      </button>
                    </div>
                    <p className="text-sm text-on-surface-variant font-medium">{recipe.author}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {recipe.tags.map(tag => (
                        <span key={tag} className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-md text-xs">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center shrink-0 z-10">
                    <button className="w-10 h-10 rounded-full bg-surface-container-low text-error flex items-center justify-center hover:bg-error/10 transition-colors">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    </button>
                    <span className="text-xs font-bold text-on-surface-variant mt-1">{recipe.likes.toLocaleString()}</span>
                  </div>
                  {recipe.rank === 1 && (
                     <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary-container/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                  )}
                </article>
              ))}
            </motion.div>
          )}

          {currentTab === '셀럽/쉐프' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold">인증된 프로의 맛 👨‍🍳</h2>
              </div>
              
              {celebRecipes.map(recipe => (
                <article key={recipe.id} className="bg-white rounded-xl p-0 shadow-sm border border-surface-variant cursor-pointer hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                  <div className="h-32 bg-surface-container-high relative w-full flex items-center justify-center overflow-hidden">
                    <img src={`https://images.unsplash.com/photo-1556910103-1c02745a872e?w=400&q=80`} alt="Chef Recipe" className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                       <span className="text-white font-bold text-lg">{recipe.author}</span>
                    </div>
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <div className="flex-1 pr-2">
                      <div className="flex justify-between items-start">
                        <h3 className="text-lg font-bold text-on-surface leading-tight mb-1">{recipe.title}</h3>
                        <button onClick={(e) => toggleSave(recipe.id, e)} className={`p-1 -mt-1 -mr-1 transition-colors ${savedRecipes.includes(recipe.id) ? 'text-primary' : 'text-outline hover:text-primary'}`}>
                          <Bookmark size={20} className={savedRecipes.includes(recipe.id) ? "fill-primary" : ""} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {recipe.tags.map(tag => (
                          <span key={tag} className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-md text-xs font-medium">#{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center shrink-0">
                      <button className="w-10 h-10 rounded-full bg-surface-container-low text-error flex items-center justify-center hover:bg-error/10 transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                      </button>
                      <span className="text-xs font-bold text-on-surface-variant mt-1">{recipe.likes.toLocaleString()}</span>
                    </div>
                  </div>
                </article>
              ))}
            </motion.div>
          )}

        </main>

        {currentTab === '맞춤추천' && (
          <div className="fixed bottom-0 left-0 w-full md:max-w-md md:left-1/2 md:-translate-x-1/2 bg-gradient-to-t from-surface via-surface to-transparent pt-10 pb-8 px-5 z-40">
            <button className="w-full h-14 bg-primary text-white rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 hover:bg-primary/90">
              <RefreshCw size={20} /> 다른 메뉴 추천받기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const SavedView = ({ onBack, savedRecipes, toggleSave }: { onBack: () => void, savedRecipes: number[], toggleSave: (id: number, e: React.MouseEvent) => void }) => {
  const allCombined = [...allRecipes, ...communityRecipes, ...celebRecipes];
  const savedItems = allCombined.filter(r => savedRecipes.includes(r.id));

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
          {savedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 mt-20 text-on-surface-variant">
              <Bookmark size={48} className="mb-4 text-outline" />
              <p>아직 저장한 레시피가 없어요.</p>
            </div>
          ) : (
            savedItems.map((recipe: any) => (
              <article key={recipe.id} className="bg-white rounded-xl p-5 shadow-sm border border-surface-variant flex flex-col gap-3 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <h2 className="text-lg font-bold text-on-surface leading-tight mb-1">{recipe.title}</h2>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {recipe.tags && recipe.tags.map((tag: string, idx: number) => (
                        <span key={idx} className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-md text-xs font-medium">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={(e) => toggleSave(recipe.id, e)} className="p-1 -mt-1 -mr-1 text-primary hover:text-primary transition-colors shrink-0">
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
};

export default function App() {
  const { user, loading: authLoading, error: authError, login, logout } = useAuth();
  const [view, setView] = useState<'home'|'receipt'|'recipe'|'saved'>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<number[]>([]);

  const toggleSave = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedRecipes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    setView('home');
    await logout();
  };

  const handleSaveReceipt = () => {
    setIngredients([
      { id: '1', name: '우유', category: '유제품', daysLeft: 2 },
      { id: '2', name: '두부', category: '콩류', daysLeft: 1 },
      { id: '3', name: '샐러드', category: '채소류', daysLeft: 0 },
      { id: '4', name: '계란', category: '기타', daysLeft: 5 },
      { id: '5', name: '사과', category: '과일', daysLeft: 10 },
      { id: '6', name: '고구마', category: '채소류', daysLeft: 14 },
      { id: '7', name: '닭가슴살', category: '육류', daysLeft: 3 },
      { id: '8', name: '청양고추', category: '채소류', daysLeft: 7 },
      { id: '9', name: '소면', category: '기타', daysLeft: 300 },
      { id: '10', name: '체다치즈', category: '유제품', daysLeft: 20 },
      { id: '11', name: '마늘', category: '채소류', daysLeft: 15 },
    ]);
    setView('home');
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
            
            {ingredients.length === 0 ? (
              <EmptyHome onUpload={() => setView('receipt')} />
            ) : (
              <PopulatedHome 
                ingredients={ingredients} 
                onUpload={() => setView('receipt')}
                onRecipe={() => setView('recipe')}
                onDelete={(id) => setIngredients(prev => prev.filter(item => item.id !== id))}
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
             <RecipeView onBack={() => setView('home')} savedRecipes={savedRecipes} toggleSave={toggleSave} />
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
             <SavedView onBack={() => setView('home')} savedRecipes={savedRecipes} toggleSave={toggleSave} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

