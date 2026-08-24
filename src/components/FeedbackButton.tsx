import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MessageSquarePlus } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { ApiError, submitFeedback } from '../lib/api';
import { track } from '../lib/firebase';
import { useToast } from './Toast';

const MIN_LENGTH = 5;

/**
 * 어느 화면에서든 바로 의견을 남길 수 있게 하는 전역 진입점.
 * 하단 CTA 버튼들과 겹치지 않도록 화면 오른쪽 중간에 띄운다.
 */
export default function FeedbackButton() {
  const toast = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  const close = () => {
    if (pending) return;
    setOpen(false);
    setMessage('');
  };

  const submit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < MIN_LENGTH || pending) return;
    setPending(true);
    try {
      const { bonusGranted } = await submitFeedback(trimmed, location.pathname);
      track('feedback_submit', { bonusGranted });
      toast.success(
        bonusGranted
          ? '의견 감사해요! 이용권을 드렸어요 🎁 (추천·조리법 20회, 영수증 인식 10회 추가)'
          : '소중한 의견 감사해요. 확인하고 반영할게요!',
      );
      setOpen(false);
      setMessage('');
    } catch (e) {
      console.error('피드백 전송 실패:', e);
      toast.error(e instanceof ApiError ? e.message : '전송에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          track('feedback_button_click');
          setOpen(true);
        }}
        aria-label="의견 보내기"
        className="fixed right-4 bottom-52 z-50 w-12 h-12 rounded-full bg-white border border-outline-variant shadow-lg flex items-center justify-center text-primary hover:bg-surface-container-low transition-colors"
      >
        <MessageSquarePlus size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={close}>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 shadow-xl flex flex-col gap-4"
          >
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-on-surface">불편한 점, 편하게 남겨주세요</h3>
              <p className="text-sm text-on-surface-variant">
                뭘 해보려다 막혔는지, 뭐가 헷갈렸는지 알려주시면 큰 도움이 돼요. 처음 남기면 이용권을 드려요.
              </p>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              autoFocus
              rows={4}
              maxLength={1000}
              placeholder="예: 레시피 목록 로딩이 오래 걸려서 기다리다 나갔어요"
              className="w-full bg-white rounded-xl p-3 border border-outline-variant focus:ring-1 focus:ring-primary outline-none text-sm resize-none"
            />

            <div className="flex gap-3">
              <button
                onClick={close}
                disabled={pending}
                className="flex-1 h-12 rounded-xl bg-surface-container-high text-on-surface font-semibold hover:bg-surface-dim transition-colors disabled:opacity-60"
              >
                취소
              </button>
              <button
                onClick={() => void submit()}
                disabled={message.trim().length < MIN_LENGTH || pending}
                className="flex-1 h-12 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                {pending ? '보내는 중...' : '보내기'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
