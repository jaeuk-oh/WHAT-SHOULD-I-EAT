/*
 * 냉털메이트 서비스워커.
 *
 * 목표는 오프라인 완전 동작이 아니라 "냉장고 앞에서 즉시 열리는 것"이다.
 *  - 정적 자산: 캐시 우선 (재방문 시 즉시 렌더)
 *  - 화면 이동: 네트워크 우선, 실패하면 캐시된 셸 (지하철·엘리베이터 대응)
 *  - API·인증 요청: 절대 캐시하지 않는다
 */
const VERSION = 'v1';
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const SHELL_URL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([SHELL_URL, '/manifest.webmanifest'])),
  );
  // 새 버전을 곧바로 적용한다 — 배포 후 낡은 셸이 남지 않게
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // 사용자 데이터와 인증 흐름은 항상 네트워크로
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/auth')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(SHELL_URL, copy));
          return response;
        })
        .catch(() => caches.match(SHELL_URL).then((cached) => cached ?? Response.error())),
    );
    return;
  }

  // 해시가 붙은 빌드 산출물이라 캐시 우선이 안전하다
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
