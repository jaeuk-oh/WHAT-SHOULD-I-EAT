import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Bell, Bookmark, ChevronRight, FileText, LogOut, Refrigerator, Shield, UserCircle, UserX } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import AppHeader from '../components/AppHeader';
import { useToast } from '../components/Toast';
import { deleteAccount } from '../lib/api';
import { FRIDGE_TYPES, FRIDGE_TYPE_LABELS, type FridgeType } from '../types';

const CONFIRM_WORD = '탈퇴';

function DeleteAccountModal({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (input.trim() !== CONFIRM_WORD || pending) return;
    setPending(true);
    try {
      await deleteAccount();
      onDeleted();
    } catch (e) {
      console.error('회원 탈퇴 실패:', e);
      toast.error(e instanceof Error ? e.message : '탈퇴 처리에 실패했어요.');
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-5"
      >
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-on-surface">정말 탈퇴하시겠어요?</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            등록한 재료, 저장한 레시피, 소진 기록이 <b className="text-error">모두 삭제되며 되돌릴 수 없어요.</b>
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="confirm-word" className="text-sm font-medium text-on-surface-variant">
            확인을 위해 <b className="text-on-surface">{CONFIRM_WORD}</b>를 입력해주세요
          </label>
          <input
            id="confirm-word"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            className="w-full h-12 bg-white rounded-xl px-4 border border-outline-variant focus:ring-1 focus:ring-error outline-none"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={pending} className="flex-1 h-12 rounded-xl bg-surface-container-high text-on-surface font-semibold hover:bg-surface-dim transition-colors">
            취소
          </button>
          <button
            onClick={submit}
            disabled={input.trim() !== CONFIRM_WORD || pending}
            className="flex-1 h-12 rounded-xl bg-error text-white font-semibold disabled:opacity-40 hover:bg-error/90 transition-colors"
          >
            {pending ? '처리 중...' : '탈퇴하기'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function SettingsView({
  user,
  onLogout,
  notifyExpiry,
  onToggleNotify,
  fridgeType,
  onSetFridgeType,
}: {
  user: User;
  onLogout: () => Promise<void>;
  notifyExpiry: boolean;
  onToggleNotify: () => void;
  fridgeType: FridgeType;
  onSetFridgeType: (type: FridgeType) => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [showDelete, setShowDelete] = useState(false);

  const rowClass =
    'w-full flex items-center gap-3 px-5 h-14 bg-white hover:bg-surface-container-low transition-colors text-left';

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <div className="w-full max-w-md mx-auto bg-surface min-h-screen">
        <AppHeader title="설정" />

        <main className="flex flex-col gap-6 pb-16">
          <section className="px-5 flex items-center gap-4">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-14 h-14 rounded-full border border-outline-variant" />
            ) : (
              <UserCircle size={56} className="text-outline" />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-on-surface truncate">{user.displayName ?? '이름 없음'}</p>
              <p className="text-sm text-on-surface-variant truncate">{user.email}</p>
            </div>
          </section>

          <section className="rounded-xl overflow-hidden border border-surface-variant divide-y divide-surface-variant mx-5">
            <Link to="/saved" className={rowClass}>
              <Bookmark size={20} className="text-on-surface-variant" />
              <span className="flex-1 font-medium">저장한 레시피</span>
              <ChevronRight size={18} className="text-outline" />
            </Link>
            <Link to="/terms" className={rowClass}>
              <FileText size={20} className="text-on-surface-variant" />
              <span className="flex-1 font-medium">이용약관</span>
              <ChevronRight size={18} className="text-outline" />
            </Link>
            <Link to="/privacy" className={rowClass}>
              <Shield size={20} className="text-on-surface-variant" />
              <span className="flex-1 font-medium">개인정보처리방침</span>
              <ChevronRight size={18} className="text-outline" />
            </Link>
          </section>

          <section className="rounded-xl overflow-hidden border border-surface-variant mx-5">
            <button onClick={onToggleNotify} className={`${rowClass} justify-between`}>
              <span className="flex items-center gap-3">
                <Bell size={20} className="text-on-surface-variant" />
                <span className="font-medium">임박 재료 알림</span>
              </span>
              <span className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${notifyExpiry ? 'bg-primary' : 'bg-outline-variant'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${notifyExpiry ? 'translate-x-4' : ''}`} />
              </span>
            </button>
          </section>

          <section className="rounded-xl border border-surface-variant mx-5 p-4 space-y-3">
            <span className="flex items-center gap-3 font-medium">
              <Refrigerator size={20} className="text-on-surface-variant" />
              가상 냉장고 모양
            </span>
            <p className="text-xs text-on-surface-variant -mt-2">
              홈 화면에서 재료를 냉장고 안에 넣어보는 모양이에요. 실제 기종과 무관해요.
            </p>
            <div className="flex gap-2">
              {FRIDGE_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => onSetFridgeType(type)}
                  aria-pressed={fridgeType === type}
                  className={`flex-1 h-12 rounded-lg text-sm font-semibold transition-colors ${
                    fridgeType === type
                      ? 'bg-primary text-white'
                      : 'bg-surface-container-low text-on-surface-variant border border-outline-variant'
                  }`}
                >
                  {FRIDGE_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl overflow-hidden border border-surface-variant divide-y divide-surface-variant mx-5">
            <button
              onClick={async () => {
                await onLogout();
                navigate('/', { replace: true });
              }}
              className={rowClass}
            >
              <LogOut size={20} className="text-on-surface-variant" />
              <span className="flex-1 font-medium">로그아웃</span>
            </button>
            <button onClick={() => setShowDelete(true)} className={`${rowClass} text-error`}>
              <UserX size={20} />
              <span className="flex-1 font-medium">회원 탈퇴</span>
            </button>
          </section>

          <p className="px-5 text-xs text-outline leading-relaxed">
            문의: <a href="mailto:tony66@whatonsolve.com" className="underline">tony66@whatonsolve.com</a>
          </p>
        </main>
      </div>

      {showDelete && (
        <DeleteAccountModal
          onClose={() => setShowDelete(false)}
          onDeleted={async () => {
            toast.success('탈퇴가 완료되었어요. 그동안 이용해주셔서 감사합니다.');
            await onLogout();
            navigate('/', { replace: true });
          }}
        />
      )}
    </div>
  );
}
