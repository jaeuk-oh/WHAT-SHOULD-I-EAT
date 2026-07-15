import { auth } from './firebase';
import type { NewIngredient } from '../types';

async function authedPost<T>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `요청에 실패했어요 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function scanReceipt(imageDataUrl: string): Promise<NewIngredient[]> {
  const data = await authedPost<{ items: NewIngredient[] }>('/api/receipt-scan', { image: imageDataUrl });
  return data.items;
}
