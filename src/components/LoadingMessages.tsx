import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

/**
 * AI 응답을 기다리는 동안 돌아가는 상태 메시지.
 * NVIDIA NIM 호출이 수 초~수십 초 걸릴 수 있어서(레시피 추천/조리법/영수증 인식 모두),
 * 고정된 한 줄보다 진행되고 있다는 느낌을 주는 편이 체감 대기시간을 줄인다.
 * 실제로 몇 %인지는 알 수 없으므로 가짜 진행률 바 대신 문구만 순환시킨다.
 */
export default function LoadingMessages({
  messages,
  intervalMs = 2200,
  className = 'text-sm font-semibold text-primary',
}: {
  messages: string[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    if (messages.length <= 1) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % messages.length), intervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.join('|'), intervalMs]);

  return (
    <div aria-live="polite" className="overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className={className}
        >
          {messages[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
