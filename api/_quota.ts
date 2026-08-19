import { getAdminDb } from './_admin.js';

/**
 * 사용자별 남용 방어.
 *
 * 2단계로 막는다.
 *  - 단기 레이트리밋(슬라이딩 윈도우): 연타/자동화 스크립트 차단
 *  - 일일 쿼터: OpenAI 비용 상한선
 *
 * 카운터는 Firestore `usage/{uid}` 문서에 Admin SDK 트랜잭션으로 기록한다.
 * 클라이언트는 이 문서를 읽을 수만 있고 쓸 수 없다(firestore.rules 참고).
 */

export type QuotaEndpoint =
  | 'receiptScan'
  | 'recommend'
  | 'recipeDetail'
  | 'youtubeSearch'
  | 'accountDelete';

interface Limits {
  /** 하루 최대 호출 수 (KST 자정 리셋) */
  perDay: number;
  /** 슬라이딩 윈도우 길이(초) */
  windowSec: number;
  /** 윈도우 내 최대 호출 수 */
  perWindow: number;
}

export const LIMITS: Record<QuotaEndpoint, Limits> = {
  // Vision 호출이라 가장 비싸다 — 가장 빡빡하게
  receiptScan: { perDay: 30, windowSec: 60, perWindow: 5 },
  recommend: { perDay: 60, windowSec: 60, perWindow: 10 },
  recipeDetail: { perDay: 60, windowSec: 60, perWindow: 10 },
  // YouTube 무료 할당량은 검색 100회/일이 전부다(전체 사용자 합산).
  // 대부분은 캐시가 흡수하지만, 사용자가 늘면 전역 상한도 함께 걸어야 한다.
  youtubeSearch: { perDay: 40, windowSec: 60, perWindow: 10 },
  accountDelete: { perDay: 5, windowSec: 300, perWindow: 3 },
};

export interface QuotaResult {
  allowed: boolean;
  /** 오늘 남은 호출 수 */
  remaining: number;
  /** 거절됐을 때 재시도까지 대기할 초 */
  retryAfterSec: number;
  reason?: 'rate' | 'daily';
}

/** KST 기준 날짜 문자열 (YYYY-MM-DD). 한국 사용자 기준으로 자정에 리셋한다. */
function kstDay(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** KST 다음 자정까지 남은 초 */
function secUntilKstMidnight(now: Date): number {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const sinceMidnight = kstMs % (24 * 60 * 60 * 1000);
  return Math.ceil((24 * 60 * 60 * 1000 - sinceMidnight) / 1000);
}

interface EndpointState {
  day: string;
  count: number;
  /** 윈도우 내 호출 시각(ms) */
  hits: number[];
}

/** 순수 판정 로직 — 저장소와 무관하게 다음 상태와 결과를 계산한다. */
function evaluate(prev: EndpointState | undefined, limits: Limits, now: Date): {
  result: QuotaResult;
  next: EndpointState;
} {
  const today = kstDay(now);
  const nowMs = now.getTime();
  const windowStart = nowMs - limits.windowSec * 1000;

  const sameDay = prev?.day === today;
  const count = sameDay ? (prev?.count ?? 0) : 0;
  const hits = (prev?.hits ?? []).filter((t) => typeof t === 'number' && t > windowStart);

  if (count >= limits.perDay) {
    return {
      result: {
        allowed: false,
        remaining: 0,
        retryAfterSec: secUntilKstMidnight(now),
        reason: 'daily',
      },
      next: { day: today, count, hits },
    };
  }

  if (hits.length >= limits.perWindow) {
    const oldest = Math.min(...hits);
    const retryAfterSec = Math.max(1, Math.ceil((oldest + limits.windowSec * 1000 - nowMs) / 1000));
    return {
      result: {
        allowed: false,
        remaining: Math.max(0, limits.perDay - count),
        retryAfterSec,
        reason: 'rate',
      },
      next: { day: today, count, hits },
    };
  }

  const next: EndpointState = { day: today, count: count + 1, hits: [...hits, nowMs] };
  return {
    result: {
      allowed: true,
      remaining: Math.max(0, limits.perDay - next.count),
      retryAfterSec: 0,
    },
    next,
  };
}

// Admin SDK가 없을 때만 쓰는 폴백. 서버리스라 인스턴스마다 독립이므로 방어력이 약하다.
const memoryStore = new Map<string, EndpointState>();
let warnedNoAdmin = false;

export async function consumeQuota(uid: string, endpoint: QuotaEndpoint): Promise<QuotaResult> {
  const limits = LIMITS[endpoint];
  const now = new Date();
  const db = getAdminDb();

  if (!db) {
    if (!warnedNoAdmin) {
      warnedNoAdmin = true;
      console.warn(
        '[quota] FIREBASE_SERVICE_ACCOUNT 미설정 — 인스턴스 메모리 폴백으로 동작합니다. ' +
          '프로덕션에서는 반드시 서비스 계정을 설정하세요.',
      );
    }
    const key = `${uid}:${endpoint}`;
    const { result, next } = evaluate(memoryStore.get(key), limits, now);
    memoryStore.set(key, next);
    return result;
  }

  const ref = db.collection('usage').doc(uid);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists ? (snap.data()?.[endpoint] as EndpointState | undefined) : undefined;
      const { result, next } = evaluate(prev, limits, now);
      // 거절된 경우에도 정리된 윈도우 상태를 저장해 hits 배열이 무한히 자라지 않게 한다
      tx.set(ref, { [endpoint]: next, updatedAt: now }, { merge: true });
      return result;
    });
  } catch (e) {
    // 카운터 장애로 서비스 전체가 멈추지 않도록 통과시키되, 반드시 알 수 있게 남긴다
    console.error('[quota] 카운터 트랜잭션 실패 — 이번 요청은 통과시킵니다:', e);
    return { allowed: true, remaining: limits.perDay, retryAfterSec: 0 };
  }
}
