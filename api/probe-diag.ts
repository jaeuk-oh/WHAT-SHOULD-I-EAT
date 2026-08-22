import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 임시 진단 엔드포인트 — 원인 확인 후 반드시 삭제한다.
 *
 * guard(_utils→_quota→_admin)를 쓰는 /api/* 5개가 프로덕션에서
 * FUNCTION_INVOCATION_FAILED로 죽는데, 인증 없이 런타임 로그를 볼 수 없어
 * 어느 임포트가 깨지는지 엔드포인트가 직접 보고하게 만든다.
 *
 * 중요: 반드시 **리터럴** 동적 임포트여야 한다.
 * 변수 specifier(`import(x)`)는 Vercel의 의존성 추적(nft)이 보지 못해
 * 패키지가 번들에 들어가지 않고, 그러면 실제 원인과 무관하게 전부 실패한다.
 */

const TOKEN = 'naengteol-probe-8f21';

const CHECKS: [string, () => Promise<unknown>][] = [
  ['jose', () => import('jose')],
  ['openai', () => import('openai')],
  ['firebase-admin/app', () => import('firebase-admin/app')],
  ['firebase-admin/auth', () => import('firebase-admin/auth')],
  ['firebase-admin/firestore', () => import('firebase-admin/firestore')],
  ['./_admin.js', () => import('./_admin.js')],
  ['./_quota.js', () => import('./_quota.js')],
  ['./_utils.js', () => import('./_utils.js')],
  ['./_core.js', () => import('./_core.js')],
  ['./_youtube.js', () => import('./_youtube.js')],
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.query.t !== TOKEN) {
    return res.status(404).json({ error: 'not found' });
  }

  const imports: Record<string, string> = {};
  for (const [name, load] of CHECKS) {
    try {
      await load();
      imports[name] = 'ok';
    } catch (e) {
      const err = e as { code?: string; message?: string };
      imports[name] = `${err.code ?? 'ERROR'}: ${(err.message ?? String(e)).slice(0, 300)}`;
    }
  }

  return res.status(200).json({ node: process.version, imports });
}
