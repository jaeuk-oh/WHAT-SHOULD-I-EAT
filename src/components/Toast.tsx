import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** alert() 대신 쓰는 비차단 알림. 실패 안내가 모바일에서 조악해지지 않게 한다. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast는 ToastProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}

const STYLES: Record<ToastKind, { icon: React.ReactNode; className: string }> = {
  success: { icon: <CheckCircle size={18} />, className: 'bg-primary text-white' },
  error: { icon: <AlertCircle size={18} />, className: 'bg-error text-white' },
  info: { icon: <Info size={18} />, className: 'bg-on-surface text-white' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, kind }]);
    // 에러는 읽을 시간이 더 필요하다
    const ttl = kind === 'error' ? 5000 : 3000;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ttl);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m: string) => show(m, 'success'),
      error: (m: string) => show(m, 'error'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-5 pointer-events-none"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className={`w-full max-w-sm rounded-xl px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-medium ${STYLES[toast.kind].className}`}
            >
              <span className="shrink-0">{STYLES[toast.kind].icon}</span>
              <span className="flex-1">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
