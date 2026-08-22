# 냉털메이트 🧊

영수증만 올리면, 오늘 뭐 먹을지 정해드려요. 냉장고 재료 관리 + AI 레시피 추천 서비스.

"내가 가진 재료로 뭘 만들 수 있나"는 규칙으로 못 푼다. 재료 조합의 경우의 수가 무한하고,
같은 재료라도 사용자 요청("매운 거", "빨리 되는 거")에 따라 답이 달라진다. 그래서 이 부분만
생성형 모델에 맡기고, 나머지(재고 관리, 사용량 집계, 결제 없음)는 전부 코드로 처리한다.

- **제품 정의** (누가·왜 쓰는가, 기능 우선순위): [`docs/PRODUCT.md`](docs/PRODUCT.md)
- **런칭 계획** (아키텍처, 블로커, 체크리스트): [`docs/LAUNCH_PLAN.md`](docs/LAUNCH_PLAN.md)
- **운영 런북** (장애 대응, 배포): [`docs/RUNBOOK.md`](docs/RUNBOOK.md)
- **트러블슈팅 기록**: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)

## 기능

- **구글 로그인** — Firebase Auth. 카카오톡·인스타 인앱 브라우저에서는 리다이렉트 방식으로 자동 폴백
- **영수증 인식** — 사진을 올리면 NVIDIA NIM 비전 모델이 식재료·수량·카테고리·예상 보관일수를 추출
- **재료 관리** — Firestore 실시간 동기화, 검색, 카테고리 필터, 유통기한 D-day
- **소진 기록** — "다 먹었어요 / 버렸어요"를 구분해 기록하고, 이번 달 소진율을 리포트로 보여줌 (`users/{uid}/log`)
- **AI 레시피 추천** — 임박 재료 우선, 자유 프롬프트/카테고리 필터/재추천, 대체 재료 안내.
  카드마다 **재료 커버리지**("내 재료 4개 사용 · 대파만 있으면 돼요")를 보여주고 재료순/빠른순/쉬운순 정렬 지원
- **단계별 조리법** — 필요한 재료와 분량, 3~8단계 조리 순서, 단계별 체크
- **레시피 영상** — YouTube Data API로 실제 요리 영상을 찾아 공식 임베드로 재생. AI가 *무엇을* 만들지 정하고, 영상이 *어떻게* 만드는지 보여준다
- **커뮤니티/셀럽 레시피** — Firestore `recipes` 컬렉션, 중복 불가 좋아요
- **요리 완료 → 재료 자동 소진** — 조리법 화면에서 "다 만들었어요"를 누르면 쓴 재료를 냉장고에서 정리
- **임박 재료 알림** — 알림을 켠 유저의 D-1 이하 재료를 매일 알림함(벨 아이콘)에 쌓음 (Vercel Cron)
- **저장한 레시피** — `users/{uid}/saved`에 스냅샷 저장 (AI 레시피는 조리법까지 저장)
- **PWA** — 홈 화면 설치, 재방문 시 즉시 로딩

## 아키텍처

```
브라우저 (Vite + React SPA, react-router)
 ├─ Firebase Auth / Firestore ── 직접 연결 (firestore.rules로 보호)
 └─ /api/* (Vercel Functions) ── 토큰 검증 → 쿼터 게이트 → NVIDIA NIM
      ├─ POST /api/receipt-scan       영수증 이미지 → 재료 목록      (하루 30회)
      ├─ POST /api/recommend          재료 목록 → 레시피 추천        (하루 60회)
      ├─ POST /api/recipe-detail      레시피 이름 → 단계별 조리법    (하루 60회)
      ├─ POST /api/youtube-recipes    레시피 이름 → 유튜브 영상      (하루 40회, 7일 캐시)
      ├─ POST /api/account-delete     회원 탈퇴 (데이터 + 계정 삭제) (하루 5회)
      └─ GET  /api/cron/expiry-notify 매일 실행, 임박 재료를 알림함에 적재 (Vercel Cron)
```

모든 요청형 API는 `api/_utils.ts`의 `guard()`를 통과한다: **POST 검사 → Firebase ID 토큰 검증(`jose`) → 사용량 차감**.
사용량 카운터는 Firestore `usage/{uid}`에 Admin SDK 트랜잭션으로 기록하며, 클라이언트는 읽기만 가능하다.
NVIDIA API 키는 서버에만 존재한다.

`api/_core.ts`는 [NVIDIA NIM](https://build.nvidia.com)의 OpenAI 호환 엔드포인트(`integrate.api.nvidia.com`)를
`openai` SDK로 호출한다(`baseURL`만 바꿔치기). 텍스트 추천/조리법은 `nvidia/nemotron-3.5-lightning-30b-a3b`,
영수증 인식은 비전-언어 모델 `nvidia/nemotron-nano-12b-v2-vl`을 쓴다(둘 다 `.env.example` 참고, 환경변수로 교체 가능).
**NVIDIA NIM은 OpenAI의 `response_format: json_schema` 같은 구조화 출력을 지원하지 않는다** — 대신
시스템 프롬프트에 JSON 형식을 명시하고, 응답에서 JSON 부분만 골라 파싱한 뒤 누락 필드를 기본값으로 채운다
(`_core.ts`의 `extractJson`). 스키마가 강제되지 않으므로 프롬프트를 고치면 이 파싱/기본값 로직도 함께 확인할 것.

크론 함수는 사용자 요청 없이 `firebase-admin`(서비스 계정)으로 Firestore를 직접 읽고
`users/{uid}/notifications`에 알림 문서를 쓰며(클라이언트는 벨 아이콘으로 구독),
`CRON_SECRET` 헤더로 외부에서의 임의 호출을 차단한다.

### 왜 이런 구조인가

돈이 나가거나(NVIDIA NIM) 신뢰가 필요한 것(사용량 집계, 계정 삭제)만 서버를 거친다.
재료·저장 레시피처럼 사용자 소유 데이터는 클라이언트가 Firestore에 직접 붙고 보안 규칙으로 막는다 —
비용과 지연 모두 이쪽이 유리하다.

### 유튜브 연동에 대해

공식 **YouTube Data API v3**로 메타데이터만 가져오고, 재생은 **공식 iframe 임베드**
(`youtube-nocookie.com`)로 한다. 채널명과 원본 링크를 항상 함께 노출해 원저작자에게 트래픽이 간다.
**자막·대본을 긁어 조리법 텍스트로 복제하지 않는다** — 그건 YouTube ToS 위반이다.

무료 할당량이 하루 10,000 유닛이고 검색 1회가 100 유닛이라 **하루 100회가 상한**이다.
쿼리 단위로 Firestore `youtubeCache`에 7일간 캐시해 이 한도를 넘지 않게 한다.
사용자가 늘면 사용자별 쿼터(`api/_quota.ts`)만으로는 부족하니 전역 상한을 함께 걸어야 한다.

## 실패와 발견

### firebase-admin을 14로 올렸다가 프로덕션 API가 전부 500이 났다

PR을 병합하면서 두 브랜치가 서로 다른 `firebase-admin` 버전을 갖고 있었다. 버전 숫자만 보고
높은 쪽(`^14.2.0`)을 골랐다. 배포 후 인증이 필요 없는 `GET /api/recommend`까지 500이 났다 —
정적 페이지는 뜨는데 `/api/*`가 전부 죽은 상태였다.

`vercel logs`는 로그인이 있어야 볼 수 있어서, 로그인 없이 쓸 수 있는 두 가지로 원인을 좁혔다.
`vercel build`를 프로젝트 사본에서 실행해 실제 배포 산출물(`.vercel/output/functions/*.func`)을
만들어 그대로 로드해봤고, 임시 진단 엔드포인트를 배포해 의심 모듈들을 각각 `import()`로 시도한
결과를 JSON으로 반환하게 했다. `firebase-admin/auth`를 쓰는 엔드포인트만 죽고, 안 쓰는 크론만
살아있다는 게 드러났다.

```
ERR_REQUIRE_ESM: require() of ES Module .../jose/dist/webapi/index.js
                 from .../jwks-rsa/src/utils.js not supported
```

`firebase-admin/auth → jwks-rsa(CommonJS) → require('jose')` 경로가 있는데, `firebase-admin 14`가
끌어오는 `jwks-rsa 4.x`는 `jose ^6`(ESM 전용)을 쓴다. 13.x는 `jose ^4`(CJS 진입점 있음)를 쓴다.
`firebase-admin`을 13.10.0으로 되돌려서 해결했다. 모듈 로드 실패는 배포 후에야 일어나므로
타입체크·빌드·CI 어디에서도 안 걸렸다.

### 알림 기능이 에러 하나 없이 조용히 죽어 있었다

`firestore.rules`의 `users/{uid}` 쓰기 허용 필드 목록에 `notifyExpiry`가 없었다. 알림 토글은
`PERMISSION_DENIED`로 실패했지만 서버 로그에는 아무것도 안 남았고, 타입체크·빌드·기존 CI는
전부 통과했다 — 보안 규칙은 코드와 별도로 배포되는 산출물이라 아무도 못 잡았다.

에뮬레이터 기반 규칙 테스트 23케이스를 CI에 추가했다(`npm run test:rules`). 이 테스트가 실제로
이 클래스의 버그를 잡는지 검증하려고, 방금 고친 필드를 다시 지운 브랜치를 만들어 CI를 돌려봤다.
타입체크+빌드(`verify`) 잡은 여전히 통과했지만, 새로 추가한 `firestore-rules` 잡은
`not ok - notifyExpiry 를 켜고 끌 수 있다`로 정확히 실패했다.

### NVIDIA 모델이 답 대신 "생각"만 하다 잘렸다

OpenAI에서 NVIDIA NIM으로 옮기며 텍스트 모델로 `nvidia/nemotron-3.5-lightning-30b-a3b`를 골랐다.
첫 실제 호출에서 `max_tokens: 200`을 줬더니 `finish_reason: "length"`로 끊겼고, `content`에는
JSON 대신 "Analyze User Input... Identify Korean Dish with Tofu and Eggs..." 같은 사고 과정만
담겨 있었다.

이 모델은 기본적으로 reasoning 트레이스를 `content`에 그대로 흘려보낸다.
`chat_template_kwargs: {"enable_thinking": false}`를 추가하니 같은 요청이 11초 만에
`{"title": "두부 스크램블"}` 같은 깨끗한 JSON만 반환했다(`api/_core.ts`의 `createTextCompletion`).

## 실제 검증

- `recommendRecipes` / `getRecipeDetail` / `scanReceiptImage` 세 함수를 `NVIDIA_API_KEY`로 직접
  호출해 확인했다. 임박 재료(D-1) 우선순위, 재료 커버리지, 조리법 단계·팁이 프롬프트대로 나왔다.
- 프로덕션 배포 후 런북 스모크 테스트: `GET /` → 200, `GET /api/*` → 405, `POST /api/*`(미인증)
  → 401, `GET /api/cron/expiry-notify`(무인증) → 503.
- 보안 규칙 회귀 테스트 23케이스가 CI의 `firestore-rules` 잡에서 통과한다.
- 영수증 인식은 API 배선(base64 이미지 전달, JSON 파싱, 빈 결과 처리)만 확인했다 — 실물 영수증
  정확도는 아직 안 봤다(아래 한계 참고).

## 한계

- 영수증 인식(NVIDIA 비전 모델)의 실물 정확도를 아직 확인하지 않았다. 작은 글씨가 많은 실제
  한국 영수증에서 얼마나 정확한지는 배포 후 실사용으로 확인해야 한다.
- 개인정보처리방침의 운영자명·사업장 주소·시행일이 아직 플레이스홀더다.
- `CRON_SECRET`을 등록하지 않아 임박 재료 알림 크론이 의도적으로 비활성(503) 상태다.
- NVIDIA NIM은 구조화 출력(json schema)을 지원하지 않아, 응답 스키마가 프롬프트 텍스트로만
  강제된다. 모델을 바꾸면 파싱(`extractJson`)이 깨질 수 있다.

## 로컬 개발

```bash
npm install
cp .env.example .env   # 값 채우기
npm run dev:api        # 터미널 1: 로컬 API 서버 (:3001)
npm run dev            # 터미널 2: Vite (:3000, /api는 :3001로 프록시)
```

| 명령 | 설명 |
|---|---|
| `npm run typecheck` | 타입 체크 |
| `npm run build` | 프로덕션 빌드 |
| `npm run seed` | 공유 레시피 시드 (Admin SDK 필요) |
| `npx tsx scripts/test-scan.ts <이미지>` | 영수증 인식 단독 검증 |
| `npx tsx scripts/test-recommend.ts "<프롬프트>"` | 추천 단독 검증 |
| `npx tsx scripts/test-youtube.ts "<레시피 이름>"` | 유튜브 검색 단독 검증 |
| `python3 scripts/generate-icons.py` | PWA 아이콘·OG 이미지 재생성 |

> `VITE_FIREBASE_DATABASE_ID`는 필수다 — AI Studio가 만든 프로젝트는 비기본 Firestore 데이터베이스를 쓴다.
> 설정값은 `firebase-applet-config.json` 참고.

## 배포 (Vercel)

```bash
npx vercel link
npx vercel env add NVIDIA_API_KEY production        # .env의 값들을 각각 등록
npx vercel env add FIREBASE_SERVICE_ACCOUNT production
npx vercel --prod
```

선택 환경변수: `YOUTUBE_API_KEY` (없으면 영상 섹션만 숨겨지고 나머지는 정상 동작)

임박 재료 알림(크론)용 추가 환경변수:

- `CRON_SECRET` — 크론 엔드포인트 보호용 시크릿 (Vercel Cron이 `Authorization: Bearer` 헤더로 전달). 없으면 엔드포인트가 503으로 막힌다

필수 환경변수: `NVIDIA_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`,
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`,
`VITE_FIREBASE_DATABASE_ID`

선택 환경변수 `NVIDIA_TEXT_MODEL` / `NVIDIA_VISION_MODEL`로 모델을 바꿀 수 있다 (기본값은 `.env.example` 참고).

> **`FIREBASE_SERVICE_ACCOUNT`를 빼먹지 말 것.** 없으면 레이트리밋이 인스턴스 메모리 폴백으로
> 동작해 방어력이 크게 떨어지고(서버리스라 인스턴스마다 카운터가 따로 논다), 회원 탈퇴가 503으로 실패하며, 크론(임박 재료 알림)도 Firestore를 읽지 못해 동작하지 않는다.

배포 전후 체크리스트는 [`docs/LAUNCH_PLAN.md`](docs/LAUNCH_PLAN.md) 4장을 따른다.
**약관·개인정보처리방침의 `[대괄호]` 플레이스홀더를 실제 운영자 정보로 채우고 법률 검토를 받은 뒤 오픈할 것.**

1. Firebase 콘솔 → Authentication → Settings → **승인된 도메인**에 배포 도메인 추가
2. Firebase 콘솔 → Firestore(해당 데이터베이스) → 규칙에 `firestore.rules` 내용 반영
3. 프로덕션 URL에서 로그인 → 재료 추가 → 영수증 스캔 → 추천 → **레시피 보기 → 이거 만들었어요** → 북마크 전체 플로우 확인
4. (알림 사용 시) 메뉴에서 **임박 재료 알림** 켜기 → `curl -H "Authorization: Bearer $CRON_SECRET" https://<도메인>/api/cron/expiry-notify`로 수동 테스트 → 앱 벨 아이콘에 알림 적재 확인
