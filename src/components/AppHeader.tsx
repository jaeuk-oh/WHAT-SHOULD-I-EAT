import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/** 하위 화면 공통 헤더. 뒤로가기는 브라우저 히스토리를 그대로 쓴다. */
export default function AppHeader({ title, fallback = '/' }: { title: string; fallback?: string }) {
  const navigate = useNavigate();

  const goBack = () => {
    // 딥링크로 바로 들어온 경우엔 돌아갈 곳이 없으므로 지정된 화면으로 보낸다
    if (window.history.length > 1) navigate(-1);
    else navigate(fallback, { replace: true });
  };

  return (
    <header className="flex justify-between items-center p-5 sticky top-0 bg-surface z-50">
      <button onClick={goBack} aria-label="뒤로 가기" className="p-2 -ml-2 rounded-full hover:bg-surface-variant">
        <ArrowLeft size={24} />
      </button>
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="w-10" />
    </header>
  );
}
