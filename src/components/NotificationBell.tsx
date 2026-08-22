import React from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

/** 헤더에 다는 알림 벨. 안 읽은 개수를 뱃지로 보여준다(9개 넘으면 "9+"). */
export default function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Link
      to="/notifications"
      aria-label={unreadCount > 0 ? `알림 (안 읽음 ${unreadCount}개)` : '알림'}
      className="relative text-on-surface-variant hover:text-primary transition-colors p-1 -m-1"
    >
      <Bell size={24} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
