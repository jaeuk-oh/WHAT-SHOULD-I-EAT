import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LoginView({
  onLogin,
  error,
}: {
  onLogin: () => Promise<void>;
  error: string | null;
}) {
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

        <ul className="w-full space-y-2 text-sm text-on-surface-variant">
          <li className="flex items-start gap-2"><span aria-hidden>🧾</span> 영수증 한 장이면 재료가 자동 등록돼요</li>
          <li className="flex items-start gap-2"><span aria-hidden>⏰</span> 상하기 전에 먼저 알려드려요</li>
          <li className="flex items-start gap-2"><span aria-hidden>🍳</span> 지금 있는 재료로 만들 메뉴를 골라드려요</li>
        </ul>

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

        <p className="text-xs text-outline text-center leading-relaxed">
          로그인하면{' '}
          <Link to="/terms" className="underline hover:text-primary">이용약관</Link>과{' '}
          <Link to="/privacy" className="underline hover:text-primary">개인정보처리방침</Link>에
          동의하는 것으로 간주됩니다.
        </p>
      </div>
    </motion.div>
  );
}
