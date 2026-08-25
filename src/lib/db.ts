import {
  collection,
  deleteDoc,
  doc,
  increment,
  limit,
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
  type AppNotification,
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
const notificationsCol = (uid: string) => collection(db, 'users', uid, 'notifications');

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

/** 여러 재료를 한 번에 소진 처리한다. 요리를 마쳤을 때 쓴다. */
export async function consumeIngredients(uid: string, items: Ingredient[], action: ConsumeAction) {
  if (items.length === 0) return;
  const batch = writeBatch(db);
  for (const item of items) {
    batch.delete(doc(ingredientsCol(uid), item.id));
    batch.set(doc(historyCol(uid)), {
      name: item.name,
      category: item.category,
      action,
      at: serverTimestamp(),
    });
  }
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

// 임박 재료 알림 수신 여부는 users/{uid} 문서의 notifyExpiry 필드로 관리한다
export function subscribeNotifyExpiry(
  uid: string,
  onChange: (enabled: boolean) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => onChange(snap.data()?.notifyExpiry === true),
    onError,
  );
}

export async function setNotifyExpiry(uid: string, enabled: boolean) {
  await setDoc(
    doc(db, 'users', uid),
    { notifyExpiry: enabled, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * 알림함(벨 아이콘). 서버(크론 등)가 만들고 클라이언트는 읽음 처리만 한다.
 * 최근 50개만 구독한다 — 뱃지 카운트와 목록 모두 이걸로 충분하다.
 */
export function subscribeNotifications(
  uid: string,
  onChange: (items: AppNotification[]) => void,
  onError?: (e: Error) => void,
) {
  const q = query(notificationsCol(uid), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            body: (data.body as string) ?? '',
            read: data.read === true,
            // serverTimestamp는 서버 확정 전까지 null이라 로컬 시각으로 메운다
            createdAt: (data.createdAt as Timestamp | null)?.toDate() ?? new Date(),
          };
        }),
      );
    },
    onError,
  );
}

export async function markNotificationRead(uid: string, id: string) {
  await setDoc(doc(notificationsCol(uid), id), { read: true }, { merge: true });
}

/** ids는 호출부에서 미리 안 읽은 것만 걸러서 넘긴다. */
export async function markAllNotificationsRead(uid: string, ids: string[]) {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  for (const id of ids) batch.set(doc(notificationsCol(uid), id), { read: true }, { merge: true });
  await batch.commit();
}

export async function deleteNotification(uid: string, id: string) {
  await deleteDoc(doc(notificationsCol(uid), id));
}

