import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { consumeQuota, type QuotaEndpoint } from './_quota.js';

// Firebase ID 토큰 서명 검증용 구글 공개키 (인스턴스 단위 캐시)
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export async function requireAuth(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!token || !projectId) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.sub) throw new Error('sub missing');
    return payload.sub;
  } catch {
    res.status(401).json({ error: '인증에 실패했습니다. 다시 로그인해주세요.' });
    return null;
  }
}

function formatWait(sec: number): string {
  if (sec < 60) return `${sec}초`;
  if (sec < 3600) return `${Math.ceil(sec / 60)}분`;
  return `${Math.ceil(sec / 3600)}시간`;
}

/**
 * 모든 /api 핸들러의 공통 관문: POST 검사 → 토큰 검증 → 쿼터 차감.
 * 통과하면 uid를 반환하고, 막히면 응답까지 끝낸 뒤 null을 반환한다.
 */
export async function guard(
  req: VercelRequest,
  res: VercelResponse,
  endpoint: QuotaEndpoint,
): Promise<string | null> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: '허용되지 않은 메서드입니다.' });
    return null;
  }

  const uid = await requireAuth(req, res);
  if (!uid) return null;

  const quota = await consumeQuota(uid, endpoint);
  res.setHeader('X-RateLimit-Remaining', String(quota.remaining));

  if (!quota.allowed) {
    res.setHeader('Retry-After', String(quota.retryAfterSec));
    const message =
      quota.reason === 'daily'
        ? '오늘 사용할 수 있는 횟수를 모두 썼어요. 내일 다시 이용해주세요.'
        : `요청이 너무 빨라요. ${formatWait(quota.retryAfterSec)} 뒤에 다시 시도해주세요.`;
    res.status(429).json({ error: message, retryAfterSec: quota.retryAfterSec, reason: quota.reason });
    return null;
  }

  return uid;
}
