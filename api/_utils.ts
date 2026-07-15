import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRemoteJWKSet, jwtVerify } from 'jose';

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
