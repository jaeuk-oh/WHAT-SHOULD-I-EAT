import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { expiryFromDays, type Ingredient, type IngredientCategory, type NewIngredient } from '../types';

const ingredientsCol = (uid: string) => collection(db, 'users', uid, 'ingredients');

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
