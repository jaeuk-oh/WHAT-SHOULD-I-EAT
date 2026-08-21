import React, { useRef, useState } from 'react';
import { Camera, CheckCircle, Plus, Receipt, RefreshCw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useToast } from '../components/Toast';
import { ApiError, scanReceipt } from '../lib/api';
import { fileToCompressedDataUrl } from '../lib/image';
import { INGREDIENT_CATEGORIES, type IngredientCategory, type NewIngredient } from '../types';

type DraftItem = { id: string; name: string; quantity: string; days: number; category: IngredientCategory };

export default function ReceiptView({ onSave }: { onSave: (items: NewIngredient[]) => Promise<void> }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setItems(
        scanned.map((s, idx) => ({
          id: `${Date.now()}-${idx}`,
          name: s.name,
          quantity: s.quantity ?? '',
          category: s.category,
          days: s.shelfLifeDays,
        })),
      );
    } catch (err) {
      console.error('영수증 인식 실패:', err);
      setScanError(err instanceof ApiError ? err.message : '영수증 인식에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setScanning(false);
    }
  };

  const updateItem = (id: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const removeItem = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const addEmptyItem = () =>
    setItems((prev) => [...prev, { id: `${Date.now()}`, name: '', quantity: '1개', days: 7, category: '기타' }]);

  const validItems = items.filter((i) => i.name.trim().length > 0);

  const handleSave = async () => {
    if (saving || validItems.length === 0) return;
    setSaving(true);
    try {
      await onSave(
        validItems.map((i) => ({
          name: i.name.trim(),
          category: i.category,
          quantity: i.quantity.trim() || '1개',
          shelfLifeDays: i.days,
        })),
      );
      toast.success(`재료 ${validItems.length}개를 등록했어요.`);
      navigate('/', { replace: true });
    } catch (e) {
      console.error('재료 저장 실패:', e);
      toast.error('저장에 실패했어요. 잠시 후 다시 시도해주세요.');
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <AppHeader title="영수증 등록" />

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
            <span className="font-semibold text-lg">
              {scanning ? '인식 중...' : previewUrl ? '다른 영수증 올리기' : '영수증 올리기'}
            </span>
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
            <p className="text-sm text-outline text-center py-6">
              아직 인식된 재료가 없어요.<br />영수증을 올리거나 직접 추가해보세요.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-xl p-3 flex flex-col gap-2 shadow-sm border border-surface-variant">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name}
                      placeholder="재료 이름"
                      aria-label="재료 이름"
                      onChange={(e) => updateItem(item.id, { name: e.target.value })}
                      className="flex-1 min-w-0 bg-surface-container-low rounded-lg px-3 py-2 border-none focus:ring-1 focus:ring-primary outline-none"
                    />
                    <button onClick={() => removeItem(item.id)} aria-label="이 재료 빼기" className="p-1 text-outline-variant hover:text-error">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.quantity}
                      placeholder="수량"
                      aria-label="수량"
                      onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                      className="w-20 shrink-0 bg-surface-container-low rounded-lg px-2 py-2 text-sm border-none focus:ring-1 focus:ring-primary outline-none"
                    />
                    <select
                      value={item.category}
                      aria-label="카테고리"
                      onChange={(e) => updateItem(item.id, { category: e.target.value as IngredientCategory })}
                      className="text-xs bg-surface-container-low rounded-lg px-2 py-2.5 border-none outline-none"
                    >
                      {INGREDIENT_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <div className={`flex items-center ml-auto px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${item.days <= 3 ? 'bg-error-container text-on-error-container' : item.days <= 7 ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      D-
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={item.days}
                        aria-label="보관일수"
                        onChange={(e) => updateItem(item.id, { days: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-10 bg-transparent border-none outline-none text-xs font-bold"
                      />
                    </div>
                  </div>
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
        <button
          onClick={handleSave}
          disabled={saving || scanning || validItems.length === 0}
          className="w-full bg-primary text-white h-14 rounded-xl font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60"
        >
          <CheckCircle size={20} /> {saving ? '저장 중...' : `이대로 저장하기${validItems.length > 0 ? ` (${validItems.length})` : ''}`}
        </button>
      </div>
    </div>
  );
}
