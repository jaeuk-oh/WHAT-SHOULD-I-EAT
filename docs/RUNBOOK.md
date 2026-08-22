# 운영 런북

장애가 났을 때 이 순서로 본다. 새로 겪은 장애는 [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)에 기록한다.

## 1. 첫 진단 — 어느 계층이 죽었나

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://<도메인>/            # 200 이어야 함
curl -sS -o /dev/null -w '%{http_code}\n' -X GET  https://<도메인>/api/recommend   # 405
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://<도메인>/api/recommend   # 401
```

| 결과 | 의심 지점 |
|---|---|
| `/` 가 200이 아님 | 정적 배포/도메인 문제 |
| GET이 405가 아니라 500 | **함수 모듈 로드 실패** — `api/`의 상대 임포트에 `.js` 누락 가능성 (CI가 잡지만 확인) |
| POST가 401이 아님 | 토큰 검증 경로 문제, `VITE_FIREBASE_PROJECT_ID` 환경변수 확인 |
| 401은 나오는데 실사용 502 | OpenAI 호출 실패 — 아래 2번 |

로그는 항상 추측보다 먼저:

```bash
npx vercel logs https://<도메인> --json | tail -50
```

## 2. API 상태 코드가 뜻하는 것

핸들러가 원인별로 코드를 나눠 두었다. 코드만으로 단계를 좁힐 수 있다.

| 코드 | 의미 | 조치 |
|---|---|---|
| 401 | 토큰 없음/무효 | 정상 동작. 대량 발생 시 클라이언트 토큰 갱신 문제 확인 |
| 405 | POST 아님 | 정상 동작 |
| 400 / 413 | 입력 검증 실패 / 이미지 초과 | 정상 동작 |
| **429** | 쿼터·레이트리밋 초과 | 정상 동작. 대량 발생 시 한도 재검토 (`api/_quota.ts`의 `LIMITS`) |
| **502** | **OpenAI 호출 실패** | 키 만료·잔액·모델명·OpenAI 장애 순으로 확인 |
| 503 | 회원 탈퇴 불가 | `FIREBASE_SERVICE_ACCOUNT` 미설정 |
| 503 (크론) | 임박 알림 크론 차단 | `CRON_SECRET` 미설정. 시크릿이 없으면 열어두지 않고 막는다 |
| 500 | 그 외 서버 오류 | 로그 필수 확인 |

## 3. 비용 급증 대응

1. OpenAI 대시보드에서 어느 모델·어느 시간대인지 확인한다.
2. Firestore `usage` 컬렉션에서 호출이 몰린 uid를 찾는다.
3. 즉시 조이려면 `api/_quota.ts`의 `LIMITS` 값을 낮추고 재배포한다.
4. 특정 계정의 악용이면 Firebase 콘솔에서 해당 계정을 비활성화한다.

> **예방**: OpenAI 대시보드의 월 하드리밋을 반드시 걸어둔다. 코드 쿼터가 뚫려도 여기서 멈춘다.

## 4. 환경변수 교체 (키 로테이션)

순서를 지키지 않으면 프로덕션이 죽는다.

1. 새 키 발급
2. 로컬 `.env` 교체 후 `npx tsx scripts/test-recommend.ts`로 검증
3. **모든 배포 환경**에 반영: `printf '%s' "$KEY" | npx vercel env add OPENAI_API_KEY production --force`
4. **재배포** (`npx vercel --prod --yes`) — 환경변수는 저장만으로 반영되지 않는다
5. 프로덕션 스모크 테스트 후 **구 키 폐기**

등록 현황은 `npx vercel env ls`로 확인한다.

## 5. 보안 규칙 배포

`firestore.rules`는 코드와 함께 자동 배포되지 않는다.
변경했다면 Firebase 콘솔 → Firestore(해당 데이터베이스) → 규칙에 반영한다.

규칙 변경 후 반드시 확인할 것:

- 다른 사용자의 `users/{uid}` 문서를 읽을 수 없는가
- `usage/{uid}` 문서를 클라이언트가 쓸 수 없는가
- 같은 레시피에 좋아요를 두 번 누를 수 없는가
- `recipes` 문서를 클라이언트가 새로 만들 수 없는가

## 6. CSP 활성화 절차

현재 `vercel.json`의 CSP는 **Report-Only**다. 잘못된 CSP는 그 자체로 장애이므로 순서를 지킨다.

1. 배포 후 실제 로그인·영수증 업로드·추천을 한 바퀴 돌린다.
2. 브라우저 콘솔의 CSP 위반 리포트를 모은다.
3. 누락된 출처를 정책에 추가한다.
4. 위반이 없으면 헤더 이름을 `Content-Security-Policy`로 바꿔 강제 적용한다.

## 7. 서비스워커 관련

배포했는데 사용자에게 옛 화면이 보인다면 서비스워커 캐시를 의심한다.
`public/sw.js`는 `skipWaiting` + `clients.claim`으로 즉시 교체되지만,
캐시 구조를 바꿨다면 `VERSION` 상수를 올려야 옛 캐시가 정리된다.

## 8. 유튜브 영상이 안 나올 때

영상 섹션은 실패 시 **조용히 숨겨지도록** 설계돼 있다. 안 보인다면 순서대로 확인한다.

```bash
npx tsx scripts/test-youtube.ts "김치찌개"
```

| 증상 | 원인 |
|---|---|
| "결과 없음 — YOUTUBE_API_KEY 설정 여부를 확인하세요" | 키 미설정. 없어도 나머지 기능은 정상 동작한다 |
| 로그에 `search 실패: 403` | 할당량 소진(하루 10,000 유닛) 또는 API 미활성화 |
| 로그에 `search 실패: 400` | 키가 잘못됐거나 API 키 제한(HTTP 리퍼러 등)에 서버 호출이 막힘 |
| 특정 레시피만 결과 없음 | `videoEmbeddable=true` 필터로 임베드 금지 영상이 제외된 것. 정상 |

**할당량 소진이 잦다면**: 검색 1회가 100 유닛이라 하루 100회가 상한이다.
`youtubeCache` 컬렉션의 문서 수와 `fetchedAt`을 확인해 캐시가 실제로 먹고 있는지 본다.
캐시가 비어 있다면 `FIREBASE_SERVICE_ACCOUNT` 미설정으로 캐시 계층이 통째로 꺼진 것이다.
