import React, { useState } from 'react';
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';

/** 드래그해서 열어야 하는 최소 이동 거리 (px) */
const DRAG_THRESHOLD = -80;
/** 드래그 최대 이동 거리 = 문 너비와 동일하게 설정 */
const DOOR_TRAVEL = 200;

interface FridgeEntryTransitionProps {
  onComplete: () => void;
}

/**
 * 로그인 직후에만 표시되는 전체화면 입장 트랜지션.
 * 냉장고 문을 왼쪽으로 당기거나 "들어가기" 버튼을 누르면 문이 열리고
 * 앱의 홈 화면이 공개된다.
 *
 * 접근성: 드래그 불가 환경을 위해 "들어가기" 버튼이 항상 노출된다.
 */
export default function FridgeEntryTransition({ onComplete }: FridgeEntryTransitionProps) {
  // 이 값은 "화면상 이동 거리"가 아니라 "회전을 계산하기 위한 입력값"으로만 쓴다.
  // 문에 x(이동)를 직접 걸지 않는 이유: 경첩에 달린 문은 옆으로 미끄러지지 않고 제자리에서 돈다 —
  // x와 rotateY를 동시에 걸면 "회전"이 아니라 "미끄러져 나가는" 것처럼 보인다.
  const dragX = useMotionValue(0);
  // 드래그 거리 → 문 열림 각도 (0° → -78°, 90°에 너무 가까워지면 backface가 뒤집혀 보이므로 여유를 둠)
  const doorRotateY = useTransform(dragX, [-DOOR_TRAVEL, 0], [-78, 0]);
  // 드래그 거리 → 내부 광원 밝기
  const interiorOpacity = useTransform(dragX, [-DOOR_TRAVEL, -DOOR_TRAVEL * 0.3, 0], [1, 0.55, 0]);
  // 문이 돌아갈수록(정면광을 비스듬히 받으므로) 어두워지는 음영 — 회전감을 눈에 더 확실히 준다
  const doorShade = useTransform(dragX, [-DOOR_TRAVEL, 0], [0.5, 0]);
  // 경첩 쪽(왼쪽 안)에 문이 드리우는 그림자 — 열릴수록 진해짐
  const hingeShadow = useTransform(dragX, [-DOOR_TRAVEL, -DOOR_TRAVEL * 0.5, 0], [0.05, 0.35, 0]);

  const clampOffset = (x: number) => Math.max(-DOOR_TRAVEL, Math.min(0, x));

  const [isOpening, setIsOpening] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const triggerOpen = () => {
    if (isOpening) return;
    setIsOpening(true);
    animate(dragX, -DOOR_TRAVEL, {
      type: 'spring',
      stiffness: 155,
      damping: 19,
      onComplete: () => {
        // 문이 완전히 열렸다 — 잠깐 멈춘 뒤 화면 페이드아웃
        setTimeout(() => {
          setIsExiting(true);
          setTimeout(onComplete, 580);
        }, 280);
      },
    });
  };

  /** 실제 손가락 이동량(offset)을 회전 전용 motion value에 그대로 반영한다 — 문 자체는 이동하지 않는다. */
  const handleDrag = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (isOpening) return;
    dragX.set(clampOffset(info.offset.x));
  };

  const handleDragEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (isOpening) return;
    if (dragX.get() <= DRAG_THRESHOLD || info.velocity.x < -350) {
      triggerOpen();
    } else {
      animate(dragX, 0, { type: 'spring', stiffness: 420, damping: 36 });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: isExiting ? 0.58 : 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-10"
    >
      {/* 냉장고 */}
      <motion.div
        animate={isOpening ? { scale: 1 } : { scale: [1, 1.012, 1] }}
        transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
        className="select-none"
        style={{ width: 200, height: 280 }}
      >
        <div className="relative w-full h-full" style={{ perspective: 480 }}>
          {/* ── 냉장고 내부 (문 뒤에 표시됨) ── */}
          <div
            className="absolute inset-0 rounded-[28px] overflow-hidden"
            style={{ background: 'linear-gradient(150deg, #fefce8 0%, #d4edaa 55%, #b6d97f 100%)' }}
          >
            {/* 중앙 광원 */}
            <motion.div
              style={{ opacity: interiorOpacity }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div
                className="w-36 h-36 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(255,248,140,0.85) 0%, transparent 68%)' }}
              />
            </motion.div>

            {/* 문이 열리면서 안쪽(경첩 쪽)에 드리우는 그림자 — 문이 실제로 앞으로 젖혀지는 느낌을 준다 */}
            <motion.div
              style={{
                opacity: hingeShadow,
                background: 'linear-gradient(90deg, rgba(20,30,0,0.65) 0%, transparent 60%)',
              }}
              className="absolute inset-y-0 left-0 w-2/5"
            />

            {/* 선반 라인 */}
            <div className="absolute left-5 right-5 rounded-full bg-primary/15" style={{ top: 78, height: 1 }} />
            <div className="absolute left-5 right-5 rounded-full bg-primary/15" style={{ top: 155, height: 1 }} />
            <div className="absolute left-5 right-5 rounded-full bg-primary/15" style={{ top: 222, height: 1 }} />

            {/* 음식 소품 */}
            <div className="absolute bottom-9 left-1/2 -translate-x-1/2 flex gap-2.5 items-end">
              <div className="w-5 h-9 rounded-md" style={{ background: '#f68700', opacity: 0.6 }} />
              <div className="w-6 h-6 rounded-full" style={{ background: '#c8f17a', opacity: 0.72 }} />
              <div className="w-4 h-10 rounded-sm" style={{ background: '#88b04b', opacity: 0.58 }} />
              <div className="w-5 h-7 rounded" style={{ background: '#f3e4c0', opacity: 0.78 }} />
            </div>
          </div>

          {/* ── 냉장고 문 (드래그 가능) ── */}
          {/* dragConstraints를 0,0으로 잠가서 문 자체는 옆으로 미끄러지지 않게 하고,
              onDrag에서 손가락 이동량만 읽어 rotateY 전용 motion value(dragX)에 반영한다.
              경첩에 달린 문처럼 "제자리에서 회전"하는 느낌을 내기 위함 — x와 rotateY를 같이 걸면
              미끄러져 나가는 것처럼 보여서 "진짜 열리는" 느낌이 안 났다. */}
          <motion.div
            drag={isOpening ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0}
            dragMomentum={false}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 rounded-[28px] cursor-grab active:cursor-grabbing touch-none overflow-hidden"
            style={{
              rotateY: doorRotateY,
              originX: 0,
              transformStyle: 'preserve-3d',
              background: 'linear-gradient(155deg, #f6faea 0%, #e2f0c8 100%)',
              border: '2.5px solid rgba(69, 104, 5, 0.58)',
              borderRadius: 28,
              boxShadow: '6px 10px 24px rgba(30, 40, 0, 0.22)',
            }}
          >
            {/* 문 앞면 — 캐릭터 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
              {/* 눈 */}
              <div className="flex gap-7">
                <span
                  className="block rounded-full bg-primary"
                  style={{ width: 13, height: 17 }}
                />
                <span
                  className="block rounded-full bg-primary"
                  style={{ width: 13, height: 17 }}
                />
              </div>
              {/* 웃음 */}
              <svg width="54" height="28" viewBox="0 0 54 28" fill="none" aria-hidden>
                <path d="M4 5 Q27 25 50 5" stroke="#456805" strokeWidth="3" strokeLinecap="round" />
              </svg>
              {/* 브랜드 배지 */}
              <div
                className="px-4 py-1.5 rounded-full bg-white/75 border border-primary/20"
                style={{ backdropFilter: 'blur(4px)' }}
              >
                <span className="text-sm font-bold text-primary tracking-tight">냉털메이트</span>
              </div>
            </div>

            {/* 손잡이 (오른쪽) */}
            <div
              className="absolute rounded-full bg-primary/40"
              style={{ right: 14, top: '50%', transform: 'translateY(-50%)', width: 8, height: 52 }}
            />

            {/* 광택 */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: 26,
                background: 'linear-gradient(130deg, rgba(255,255,255,0.42) 0%, transparent 52%)',
              }}
            />

            {/* 회전할수록 어두워지는 음영 — 문이 빛을 비스듬히 받게 되므로, 실제로 돌아가고 있다는 걸 눈으로 확인시켜준다 */}
            <motion.div
              style={{ opacity: doorShade, borderRadius: 26, background: '#1a2200' }}
              className="absolute inset-0 pointer-events-none"
            />
          </motion.div>
        </div>
      </motion.div>

      {/* 힌트 + 접근성 버튼 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isOpening ? 0 : 1 }}
        transition={{ duration: 0.3, delay: isOpening ? 0 : 0.5 }}
        className="flex flex-col items-center gap-3"
        aria-live="polite"
      >
        <motion.p
          animate={{ x: [0, -7, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', repeatDelay: 0.15 }}
          className="text-sm text-on-surface-variant flex items-center gap-1.5"
          aria-hidden
        >
          ← 문을 열어 들어가세요
        </motion.p>
        <button
          onClick={triggerOpen}
          disabled={isOpening}
          className="px-7 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          aria-label="냉장고 문 열고 앱으로 들어가기"
        >
          들어가기
        </button>
      </motion.div>
    </motion.div>
  );
}
