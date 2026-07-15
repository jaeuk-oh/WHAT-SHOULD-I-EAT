import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  expiryFromDays,
  type Ingredient,
  type IngredientCategory,
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
