import React from 'react';
import { Bell } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import type { AppNotification } from '../types';

function formatRelative(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

export default function NotificationsView({
  notifications,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <div className="w-full max-w-md mx-auto bg-surface min-h-screen flex flex-col">
        <AppHeader title="알림" />

        {unreadCount > 0 && (
          <div className="px-5 pb-2 flex justify-end">
            <button onClick={onMarkAllRead} className="text-sm font-medium text-primary hover:underline">
              모두 읽음 처리
            </button>
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 px-5 text-center gap-3">
            <Bell size={40} className="text-outline-variant" />
            <p className="text-on-surface-variant">아직 알림이 없어요.</p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-variant">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => !n.read && onMarkRead(n.id)}
                  className={`w-full text-left px-5 py-4 flex gap-3 items-start hover:bg-surface-container-low transition-colors ${
                    n.read ? '' : 'bg-primary/5'
                  }`}
                >
                  <span
                    className={`mt-2 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-primary'}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`font-semibold text-on-surface ${n.read ? 'opacity-70' : ''}`}>{n.title}</span>
                      <span className="text-xs text-outline shrink-0">{formatRelative(n.createdAt)}</span>
                    </span>
                    <span className="block text-sm text-on-surface-variant mt-0.5">{n.body}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
