import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface State {
  error: Error | null;
}

/**
 * 렌더 중 예외가 나도 흰 화면 대신 복구 경로를 보여준다.
 * 실제 운영에서는 componentDidCatch에서 외부 모니터링으로 보내면 된다.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('처리되지 않은 렌더 오류:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm border border-surface-variant flex flex-col items-center text-center gap-4">
          <AlertTriangle size={40} className="text-error" />
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-on-surface">문제가 생겼어요</h1>
            <p className="text-sm text-on-surface-variant">
              화면을 그리는 중에 오류가 발생했어요. 새로고침하면 대부분 해결됩니다.
            </p>
          </div>
          <button
            onClick={() => window.location.assign('/')}
            className="w-full h-12 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
          >
            처음으로 돌아가기
          </button>
        </div>
      </div>
    );
  }
}
