# 냉털메이트 🧊

영수증만 올리면, 오늘 뭐 먹을지 정해드려요. 냉장고 재료 관리 + AI 레시피 추천 서비스.

- **제품 정의** (누가·왜 쓰는가, 기능 우선순위): [`docs/PRODUCT.md`](docs/PRODUCT.md)
- **런칭 계획** (아키텍처, 블로커, 체크리스트): [`docs/LAUNCH_PLAN.md`](docs/LAUNCH_PLAN.md)
- **운영 런북** (장애 대응, 배포): [`docs/RUNBOOK.md`](docs/RUNBOOK.md)
- **트러블슈팅 기록**: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)

## 기능

- **구글 로그인** — Firebase Auth. 카카오톡·인스타 인앱 브라우저에서는 리다이렉트 방식으로 자동 폴백
- **영수증 인식** — 사진을 올리면 OpenAI Vision이 식재료·수량·카테고리·예상 보관일수를 추출
- **재료 관리** — Firestore 실시간 동기화, 검색, 카테고리 필터, 유통기한 D-day
- **소진 기록** — "다 먹었어요 / 버렸어요"를 구분해 기록하고, 이번 달 소진율을 리포트로 보여줌
- **AI 레시피 추천** — 임박 재료 우선, 자유 프롬프트/카테고리 필터/재추천, 대체 재료 안내
- **단계별 조리법** — 필요한 재료와 분량, 3~8단계 조리 순서, 단계별 체크
- **커뮤니티/셀럽 레시피** — Firestore `recipes` 컬렉션, 중복 불가 좋아요
- **저장한 레시피** — `users/{uid}/saved`에 스냅샷 저장
- **PWA** — 홈 화면 설치, 재방문 시 즉시 로딩

## 아키텍처

```
브라우저 (Vite + React SPA, react-router)
 ├─ Firebase Auth / Firestore ── 직접 연결 (firestore.rules로 보호)
 └─ /api/* (Vercel Functions) ── 토큰 검증 → 쿼터 게이트 → OpenAI
      ├─ POST /api/receipt-scan    영수증 이미지 → 재료 목록      (하루 30회)
      ├─ POST /api/recommend       재료 목록 → 레시피 추천        (하루 60회)
      ├─ POST /api/recipe-detail   레시피 이름 → 단계별 조리법    (하루 60회)
      └─ POST /api/account-delete  회원 탈퇴 (데이터 + 계정 삭제) (하루 5회)
```

모든 API는 `api/_utils.ts`의 `guard()`를 통과한다: **POST 검사 → Firebase ID 토큰 검증(`jose`) → 사용량 차감**.
사용량 카운터는 Firestore `usage/{uid}`에 Admin SDK 트랜잭션으로 기록하며, 클라이언트는 읽기만 가능하다.
OpenAI 키는 서버에만 존재한다.

### 왜 이런 구조인가

돈이 나가거나(OpenAI) 신뢰가 필요한 것(사용량 집계, 계정 삭제)만 서버를 거친다.
재료·저장 레시피처럼 사용자 소유 데이터는 클라이언트가 Firestore에 직접 붙고 보안 규칙으로 막는다 —
비용과 지연 모두 이쪽이 유리하다.

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
| `python3 scripts/generate-icons.py` | PWA 아이콘·OG 이미지 재생성 |

> `VITE_FIREBASE_DATABASE_ID`는 필수다 — AI Studio가 만든 프로젝트는 비기본 Firestore 데이터베이스를 쓴다.
> 설정값은 `firebase-applet-config.json` 참고.

## 배포 (Vercel)

```bash
npx vercel link
npx vercel env add OPENAI_API_KEY production        # .env의 값들을 각각 등록
npx vercel env add FIREBASE_SERVICE_ACCOUNT production
npx vercel --prod
```

필수 환경변수: `OPENAI_API_KEY`, `OPENAI_MODEL`, `FIREBASE_SERVICE_ACCOUNT`,
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`,
`VITE_FIREBASE_DATABASE_ID`

> **`FIREBASE_SERVICE_ACCOUNT`를 빼먹지 말 것.** 없으면 레이트리밋이 인스턴스 메모리 폴백으로
> 동작해 방어력이 크게 떨어지고(서버리스라 인스턴스마다 카운터가 따로 논다), 회원 탈퇴가 503으로 실패한다.

배포 전후 체크리스트는 [`docs/LAUNCH_PLAN.md`](docs/LAUNCH_PLAN.md) 4장을 따른다.
**약관·개인정보처리방침의 `[대괄호]` 플레이스홀더를 실제 운영자 정보로 채우고 법률 검토를 받은 뒤 오픈할 것.**
