import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  expiryFromDays,
  type CommunityRecipe,
  type ConsumptionAction,
  type Ingredient,
  type IngredientCategory,
  type MonthlyStats,
  type NewIngredient,
  type RecipeSource,
  type SavedRecipe,
  type SavedRecipeInput,
} from '../types';

const ingredientsCol = (uid: string) => collection(db, 'users', uid, 'ingredients');
const savedCol = (uid: string) => collection(db, 'users', uid, 'saved');

// 레시피 제목을 문서 ID로 사용해 저장/해제가 멱등이 되게 한다 ('/'는 문서 ID에 쓸 수 없음)
const savedDocId = (title: string) => title.replace(/\//g, '-').slice(0, 100);

export function subscribeSavedRecipes(
  uid: string,
  onChange: (items: SavedRecipe[]) => void,
  onError?: (e: Error) => void,
) {
  const q = query(savedCol(uid), orderBy('savedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            source: (data.source as RecipeSource) ?? 'ai',
            time: (data.time as string) ?? '',
            difficulty: (data.difficulty as string) ?? '',
            author: (data.author as string) ?? '',
            tags: (data.tags as string[]) ?? [],
            servings: (data.servings as string) ?? undefined,
            usedIngredients: (data.usedIngredients as SavedRecipe['usedIngredients']) ?? undefined,
            steps: (data.steps as string[]) ?? undefined,
          };
        }),
      );
    },
    onError,
  );
}

export async function saveRecipe(uid: string, recipe: SavedRecipeInput) {
  // Firestore는 undefined 필드 저장 시 에러를 내므로 값이 있을 때만 포함한다
  const detail: Record<string, unknown> = {};
  if (recipe.servings) detail.servings = recipe.servings;
  if (recipe.usedIngredients && recipe.usedIngredients.length > 0) detail.usedIngredients = recipe.usedIngredients;
  if (recipe.steps && recipe.steps.length > 0) detail.steps = recipe.steps;
  await setDoc(doc(savedCol(uid), savedDocId(recipe.title)), {
    title: recipe.title,
    source: recipe.source,
    time: recipe.time,
    difficulty: recipe.difficulty,
    author: recipe.author,
    tags: recipe.tags,
    ...detail,
    savedAt: serverTimestamp(),
  });
}

export async function unsaveRecipe(uid: string, title: string) {
  await deleteDoc(doc(savedCol(uid), savedDocId(title)));
}

const recipesCol = () => collection(db, 'recipes');

export function subscribeRecipes(
  onChange: (items: CommunityRecipe[]) => void,
  onError?: (e: Error) => void,
) {
  const q = query(recipesCol(), orderBy('likes', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            author: (data.author as string) ?? '',
            type: (data.type as CommunityRecipe['type']) ?? 'community',
            tags: (data.tags as string[]) ?? [],
            likes: (data.likes as number) ?? 0,
          };
        }),
      );
    },
    onError,
  );
}

export async function likeRecipe(id: string) {
  await updateDoc(doc(recipesCol(), id), { likes: increment(1) });
}

// 문서 ID를 고정해 여러 번 실행해도 중복이 생기지 않는다 (개발용 시드)
export async function seedRecipes(items: Omit<CommunityRecipe, 'id'>[], ids: string[]) {
  const batch = writeBatch(db);
  items.forEach((item, idx) => {
    batch.set(doc(recipesCol(), ids[idx]), { ...item, createdAt: serverTimestamp() });
  });
  await batch.commit();
}

export function subscribeIngredients(
  uid: string,
  onChange: (items: Ingredient[]) => void,
  onError?: (e: Error) => void,
) {
  const q = query(ingredientsCol(uid), orderBy('expiresAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name as string,
            category: data.category as IngredientCategory,
            expiresAt: (data.expiresAt as Timestamp).toDate(),
          };
        }),
      );
    },
    onError,
  );
}

export async function addIngredients(uid: string, items: NewIngredient[]) {
  const batch = writeBatch(db);
  for (const item of items) {
    batch.set(doc(ingredientsCol(uid)), {
      name: item.name,
      category: item.category,
      expiresAt: Timestamp.fromDate(expiryFromDays(item.shelfLifeDays)),
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function deleteIngredient(uid: string, id: string) {
  await deleteDoc(doc(ingredientsCol(uid), id));
}

const logCol = (uid: string) => collection(db, 'users', uid, 'log');

// 재료 소비 신호 한 건 기록 (요리/폐기). 삭제 플로우에서 사용한다.
export async function logConsumption(
  uid: string,
  entry: { name: string; category: IngredientCategory; action: ConsumptionAction },
) {
  await setDoc(doc(logCol(uid)), {
    name: entry.name,
    category: entry.category,
    action: entry.action,
    at: serverTimestamp(),
  });
}

// "이거 만들었어요": 여러 재료를 한 번에 재고에서 빼고 요리 로그로 남긴다
export async function consumeIngredients(
  uid: string,
  items: { id: string; name: string; category: IngredientCategory }[],
) {
  if (items.length === 0) return;
  const batch = writeBatch(db);
  for (const item of items) {
    batch.delete(doc(ingredientsCol(uid), item.id));
    batch.set(doc(logCol(uid)), {
      name: item.name,
      category: item.category,
      action: 'cooked',
      at: serverTimestamp(),
    });
  }
  await batch.commit();
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

// 이번 달 소비 로그를 집계해 살린/버린 재료 수를 실시간으로 돌려준다
export function subscribeMonthlyStats(
  uid: string,
  onChange: (stats: MonthlyStats) => void,
  onError?: (e: Error) => void,
) {
  const q = query(logCol(uid), where('at', '>=', Timestamp.fromDate(startOfMonth())));
  return onSnapshot(
    q,
    (snap) => {
      let cooked = 0;
      let discarded = 0;
      snap.docs.forEach((d) => {
        const action = d.data().action as ConsumptionAction;
        if (action === 'cooked') cooked += 1;
        else if (action === 'discarded') discarded += 1;
      });
      onChange({ cooked, discarded });
    },
    onError,
  );
}
