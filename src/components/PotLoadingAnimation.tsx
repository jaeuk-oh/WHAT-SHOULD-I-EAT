import React from 'react';
import { motion } from 'motion/react';
import { ItemIcon } from './ItemIcon';

const DEFAULT_CATEGORIES = ['채소류', '육류', '유제품'];

/**
 * 레시피 추천을 기다리는 동안 보여주는 냄비 보글보글 애니메이션.
 * categories를 넘기면(사용자가 가진 재료, 임박 재료 우선) 그 카테고리 아이콘이 냄비 안에서 보글거린다 —
 * 안 넘기면 기본 3종으로 대체한다.
 */
export default function PotLoadingAnimation({ categories }: { categories?: string[] }) {
  const items = (categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES).slice(0, 3);

  return (
    <div className="relative flex justify-center" style={{ width: 140, height: 104 }} aria-hidden>
      {/* 김 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-3">
        {[0, 1, 2].map((i) => (
          <motion.svg
            key={i}
            width="10"
            height="26"
            viewBox="0 0 10 26"
            fill="none"
            animate={{ y: [4, -12, 4], opacity: [0, 0.6, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, delay: i * 0.35, ease: 'easeInOut' }}
          >
            <path d="M5 24C5 24 1 17 5 12C9 7 5 2 5 2" stroke="#456805" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </motion.svg>
        ))}
      </div>

      {/* 냄비 */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2" style={{ width: 116, height: 68 }}>
        {/* 손잡이 */}
        <div className="absolute rounded-full bg-primary/40" style={{ left: -10, top: 12, width: 12, height: 7 }} />
        <div className="absolute rounded-full bg-primary/40" style={{ right: -10, top: 12, width: 12, height: 7 }} />

        {/* 몸통 — 국물 + 안에서 보글거리는 재료 */}
        <div
          className="absolute inset-x-0 bottom-0 overflow-hidden"
          style={{
            top: 16,
            borderRadius: '0 0 18px 18px',
            background: 'linear-gradient(180deg, #d4edaa 0%, #88b04b 100%)',
            border: '2.5px solid #456805',
            borderTop: 'none',
          }}
        >
          <div className="absolute inset-0 flex items-end justify-center gap-2.5 pb-1.5">
            {items.map((category, i) => (
              <motion.div
                key={category + i}
                className="text-on-primary-container"
                animate={{ y: [0, -8, 0], rotate: [-6, 6, -6] }}
                transition={{ repeat: Infinity, duration: 1.4 + i * 0.15, delay: i * 0.25, ease: 'easeInOut' }}
              >
                <ItemIcon category={category} size={14} />
              </motion.div>
            ))}
          </div>

          {/* 수면 위로 올라오는 기포 */}
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white/70"
              style={{ left: `${18 + i * 22}%`, width: 4, height: 4, bottom: 4 }}
              animate={{ y: [0, -44], opacity: [0, 0.8, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.4, ease: 'easeOut' }}
            />
          ))}
        </div>

        {/* 냄비 입구 테두리 */}
        <div className="absolute inset-x-0 rounded-full" style={{ top: 14, height: 6, background: '#456805' }} />
      </div>
    </div>
  );
}
