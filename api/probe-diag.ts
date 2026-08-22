import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 임시 진단 엔드포인트 — 원인 확인 후 반드시 삭제한다.
 *
 * guard(_utils→_quota→_admin)를 쓰는 /api/* 5개가 프로덕션에서
 * FUNCTION_INVOCATION_FAILED로 죽는데, 인증 없이 로그를 볼 수 없어
 * 어느 임포트가 깨지는지 런타임에서 직접 보고하게 만든다.
 *
 * 이 파일 자체는 무거운 것을 정적으로 임포트하지 않는다(그래야 자기가 안 죽는다).
 */

const TOKEN = 'naengteol-probe-8f21';

const TARGETS = [
  'jose',
  'openai',
  'firebase-admin/app',
  'firebase-admin/auth',
  'firebase-admin/firestore',
  './_admin.js',
  './_quota.js',
  './_utils.js',
  './_core.js',
  './_youtube.js',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.query.t !== TOKEN) {
    return res.status(404).json({ error: 'not found' });
  }

  const results: Record<string, string> = {};
  for (const target of TARGETS) {
    try {
      await import(target);
      results[target] = 'ok';
    } catch (e) {
      const err = e as { code?: string; message?: string };
      results[target] = `${err.code ?? 'ERROR'}: ${(err.message ?? String(e)).slice(0, 300)}`;
    }
  }

  return res.status(200).json({
    node: process.version,
    arch: process.arch,
    imports: results,
  });
}
