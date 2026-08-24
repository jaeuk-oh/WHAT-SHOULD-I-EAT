import React from 'react';
import { Bookmark, ChefHat, Refrigerator } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: '냉장고', icon: Refrigerator, end: true },
  { to: '/recipes', label: '레시피', icon: ChefHat, end: false },
  { to: '/saved', label: '저장', icon: Bookmark, end: false },
] as const;

/** 로그인 후 주요 화면(냉장고/레시피/저장) 사이를 오가는 하단 탭바. 서브 화면에서는 App.tsx가 숨긴다. */
export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-surface-variant shadow-[0_-4px_12px_rgba(0,0,0,0.05)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-2xl mx-auto flex items-stretch justify-around px-2 py-2">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
              }`
            }
          >
            <Icon size={22} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
