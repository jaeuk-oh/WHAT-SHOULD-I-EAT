import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.02l7.73 6c4.51-4.18 7.09-10.36 7.09-17.49z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1-.76-4.59c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.86.92 7.51 2.56 10.78z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.9l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** 친근한 냉장고 캐릭터 — 올리브/크림 브랜드 팔레트로 인라인 SVG */
function FridgeCharacter() {
  return (
    <svg viewBox="0 0 160 210" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="w-full h-full">
      {/* 바닥 그림자 */}
      <ellipse cx="80" cy="205" rx="52" ry="5.5" fill="#44493a" opacity="0.07" />

      {/* 냉장고 본체 */}
      <rect x="16" y="10" width="128" height="190" rx="22" fill="#f4f9e8" />
      <rect x="16" y="10" width="128" height="190" rx="22" stroke="#456805" strokeWidth="2.5" />

      {/* 냉동칸 구분선 */}
      <rect x="16" y="76" width="128" height="2.5" rx="1.25" fill="#456805" opacity="0.3" />

      {/* 냉동칸 내부 밝은 배경 */}
      <rect x="21" y="15" width="118" height="56" rx="16" fill="#eaf4d4" opacity="0.5" />

      {/* 눈 */}
      <circle cx="62" cy="44" r="7" fill="#456805" />
      <circle cx="98" cy="44" r="7" fill="#456805" />
      {/* 눈동자 하이라이트 */}
      <circle cx="64" cy="41.5" r="2.5" fill="white" />
      <circle cx="100" cy="41.5" r="2.5" fill="white" />

      {/* 웃음 */}
      <path d="M54 58 Q80 74 106 58" stroke="#456805" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* 볼터치 */}
      <ellipse cx="50" cy="62" rx="7" ry="4.5" fill="#f68700" opacity="0.18" />
      <ellipse cx="110" cy="62" rx="7" ry="4.5" fill="#f68700" opacity="0.18" />

      {/* 냉장칸 핸들 */}
      <rect x="130" y="96" width="7" height="40" rx="3.5" fill="#456805" opacity="0.5" />
      {/* 냉동칸 핸들 */}
      <rect x="130" y="28" width="7" height="28" rx="3.5" fill="#456805" opacity="0.5" />

      {/* 선반 라인 */}
      <line x1="30" y1="120" x2="130" y2="120" stroke="#c8f17a" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <line x1="30" y1="155" x2="130" y2="155" stroke="#c8f17a" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <line x1="30" y1="188" x2="130" y2="188" stroke="#c8f17a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

      {/* 선반 위 음식 아이템 (소품) */}
      <circle cx="52" cy="136" r="6" fill="#88b04b" opacity="0.55" />
      <rect x="66" y="128" width="9" height="14" rx="2.5" fill="#f68700" opacity="0.45" />
      <circle cx="90" cy="138" r="5.5" fill="#c8f17a" opacity="0.65" />
      <rect x="44" y="163" width="10" height="17" rx="2.5" fill="#456805" opacity="0.25" />
      <circle cx="68" cy="170" r="5" fill="#f3e4c0" opacity="0.75" />
    </svg>
  );
}

/**
 * 로그인 전 첫 화면. 심플하게: 냉장고 캐릭터 + 워드마크 + 태그라인 + 구글 버튼 + 약관 푸터.
 * 로그인은 버튼 탭으로만 시작한다 — 냉장고 문 열기 제스처는 로그인 성공 직후의
 * "입장 트랜지션"(FridgeEntryTransition)에서 별도로 진행된다.
 */
export default function LoginView({
  onLogin,
  error,
}: {
  onLogin: () => Promise<void>;
  error: string | null;
}) {
  const [pending, setPending] = useState(false);

  const handleLogin = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onLogin();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between px-8 py-12 max-w-md mx-auto">
      {/* 상단 여백 + 메인 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-7 w-full">
        {/* 냉장고 캐릭터 */}
        <motion.div
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
          className="w-40 h-52"
        >
          <FridgeCharacter />
        </motion.div>

        {/* 워드마크 + 태그라인 */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18 }}
          className="text-center space-y-2"
        >
          <h1 className="text-4xl font-bold text-primary tracking-tight">냉털메이트</h1>
          <p className="text-on-surface-variant text-base">
            냉장고에 있는 걸로, 오늘 뭐 먹을지 정해드려요
          </p>
        </motion.div>
      </div>

      {/* 하단 CTA */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="w-full space-y-4"
      >
        <button
          onClick={handleLogin}
          disabled={pending}
          className="w-full h-14 bg-white border border-outline-variant hover:bg-surface-container-low active:scale-[0.98] transition-all rounded-2xl shadow-sm flex items-center justify-center gap-3 disabled:opacity-60"
        >
          <GoogleG size={20} />
          <span className="font-semibold text-on-surface">
            {pending ? '로그인 중...' : '구글 계정으로 시작하기'}
          </span>
        </button>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-error text-center px-2"
          >
            {error}
          </motion.p>
        )}

        <p className="text-xs text-outline text-center leading-relaxed">
          로그인하면{' '}
          <Link to="/terms" className="underline hover:text-primary">이용약관</Link>과{' '}
          <Link to="/privacy" className="underline hover:text-primary">개인정보처리방침</Link>에
          동의하는 것으로 간주됩니다.
        </p>
      </motion.div>
    </div>
  );
}
