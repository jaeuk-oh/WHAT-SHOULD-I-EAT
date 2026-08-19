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
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  expiryFromDays,
  type CommunityRecipe,
  type ConsumeAction,
  type HistoryEntry,
  type Ingredient,
  type IngredientCategory,
  type NewIngredient,
  type RecipeSource,
  type SavedRecipe,
  type SavedRecipeInput,
} from '../types';

const ingredientsCol = (uid: string) => collection(db, 'users', uid, 'ingredients');
const savedCol = (uid: string) => collection(db, 'users', uid, 'saved');
const historyCol = (uid: string) => collection(db, 'users', uid, 'history');

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
          };
        }),
      );
    },
    onError,
  );
}

export async function saveRecipe(uid: string, recipe: SavedRecipeInput) {
  await setDoc(doc(savedCol(uid), savedDocId(recipe.title)), {
    title: recipe.title,
    source: recipe.source,
    time: recipe.time,
    difficulty: recipe.difficulty,
    author: recipe.author,
    tags: recipe.tags,
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

const likesCol = (uid: string) => collection(db, 'users', uid, 'likes');

/** 내가 좋아요한 레시피 ID 집합 */
export function subscribeLikes(
  uid: string,
  onChange: (ids: Set<string>) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    likesCol(uid),
    (snap) => onChange(new Set(snap.docs.map((d) => d.id))),
    onError,
  );
}

/**
 * 좋아요 토글. 표시 문서와 카운터를 한 배치로 함께 바꿔서
 * 같은 사용자가 두 번 올리는 것을 보안 규칙 단에서 막을 수 있게 한다.
 */
export async function toggleLike(uid: string, recipeId: string, currentlyLiked: boolean) {
  const batch = writeBatch(db);
  const likeRef = doc(likesCol(uid), recipeId);
  const recipeRef = doc(recipesCol(), recipeId);
  if (currentlyLiked) {
    batch.delete(likeRef);
    batch.update(recipeRef, { likes: increment(-1) });
  } else {
    batch.set(likeRef, { createdAt: serverTimestamp() });
    batch.update(recipeRef, { likes: increment(1) });
  }
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
            quantity: (data.quantity as string) ?? '',
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
      quantity: item.quantity,
      expiresAt: Timestamp.fromDate(expiryFromDays(item.shelfLifeDays)),
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/**
 * 재료를 목록에서 없애면서 그 이유를 남긴다.
 * '먹었다'와 '버렸다'를 구분해야 소진율(제품의 본질적 가치 지표)을 잴 수 있다.
 */
export async function consumeIngredient(uid: string, ingredient: Ingredient, action: ConsumeAction) {
  const batch = writeBatch(db);
  batch.delete(doc(ingredientsCol(uid), ingredient.id));
  batch.set(doc(historyCol(uid)), {
    name: ingredient.name,
    category: ingredient.category,
    action,
    at: serverTimestamp(),
  });
  await batch.commit();
}

/** 지정 시점 이후의 소진 기록. 절약 리포트에 쓴다. */
export function subscribeHistory(
  uid: string,
  since: Date,
  onChange: (entries: HistoryEntry[]) => void,
  onError?: (e: Error) => void,
) {
  const q = query(historyCol(uid), where('at', '>=', Timestamp.fromDate(since)), orderBy('at', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: (data.name as string) ?? '',
            category: (data.category as IngredientCategory) ?? '기타',
            action: (data.action as ConsumeAction) ?? 'eaten',
            // serverTimestamp는 서버 확정 전까지 null이라 로컬 시각으로 메운다
            at: (data.at as Timestamp | null)?.toDate() ?? new Date(),
          };
        }),
      );
    },
    onError,
  );
}
