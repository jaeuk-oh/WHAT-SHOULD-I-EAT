# 냉털메이트 🧊

영수증만 올리면, 오늘 뭐 먹을지 정해드려요. 냉장고 재료 관리 + AI 레시피 추천 서비스.

## 기능

- **구글 로그인** — Firebase Auth
- **재료 관리** — Firestore 실시간 동기화, 직접 추가/삭제, 유통기한 D-day 관리
- **영수증 인식** — 영수증 사진을 올리면 OpenAI Vision이 식재료·카테고리·예상 보관일수를 추출
- **AI 레시피 추천** — 냉장고 재료(임박 재료 우선) 기반 추천, 자유 프롬프트/카테고리 필터/재추천. 재료 계량·단계별 조리법 포함
- **"이거 만들었어요"** — 레시피에 쓴 재료를 냉장고에서 자동 차감하고 요리 기록으로 남김
- **냉장고 성적표** — 이번 달 살린/버린 재료 수와 활용률 피드백 (`users/{uid}/log`)
- **임박 재료 알림** — 알림을 켠 유저에게 D-1 이하 재료를 매일 이메일로 안내 (Vercel Cron)
- **커뮤니티/셀럽 레시피** — Firestore `recipes` 컬렉션, 좋아요/북마크
- **저장한 레시피** — `users/{uid}/saved`에 스냅샷 저장 (AI 레시피는 조리법까지 저장)

## 아키텍처

```
브라우저 (Vite + React SPA)
 ├─ Firebase Auth / Firestore ── 직접 연결 (firestore.rules로 보호)
 └─ /api/* (Vercel Functions) ── OpenAI 프록시 (API 키는 서버에만 존재)
      ├─ POST /api/receipt-scan       영수증 이미지 → 재료 목록
      ├─ POST /api/recommend          재료 목록 → 레시피 추천(조리법 포함)
      └─ GET  /api/cron/expiry-digest 매일 실행, 임박 재료 이메일 알림 (Vercel Cron)
```

API 함수는 Firebase ID 토큰을 검증(`jose`)한 뒤에만 OpenAI를 호출한다.
크론 함수는 `firebase-admin`(서비스 계정)으로 Firestore를 읽고 Resend로 메일을 보내며, `CRON_SECRET` 헤더로 외부 호출을 차단한다.

## 로컬 개발

```bash
npm install
cp .env.example .env   # 값 채우기 (OpenAI 키, Firebase 설정)
npm run dev:api        # 터미널 1: 로컬 API 서버 (:3001)
npm run dev            # 터미널 2: Vite (:3000, /api는 :3001로 프록시)
```

- Firebase 설정값은 `firebase-applet-config.json` 참고 (`firestoreDatabaseId`가 비기본 DB이므로 `VITE_FIREBASE_DATABASE_ID` 필수)
- 검증 스크립트: `npx tsx scripts/test-scan.ts <영수증 이미지>` / `npx tsx scripts/test-recommend.ts "프롬프트"`

## 배포 (Vercel)

```bash
npx vercel link
npx vercel env add OPENAI_API_KEY production   # .env의 값들 등록
npx vercel --prod
```

환경변수(공통): `OPENAI_API_KEY`, `OPENAI_MODEL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_DATABASE_ID`

임박 재료 이메일 알림(크론)용 추가 환경변수:

- `FIREBASE_SERVICE_ACCOUNT` — Firebase 콘솔 → 프로젝트 설정 → 서비스 계정에서 발급한 JSON을 **한 줄 문자열**로 저장
- `RESEND_API_KEY` — [Resend](https://resend.com) API 키 (메일 발송)
- `DIGEST_FROM_EMAIL` — 발신 주소 (예: `냉털메이트 <no-reply@yourdomain.com>`, 미설정 시 Resend 테스트 발신자)
- `CRON_SECRET` — 크론 엔드포인트 보호용 시크릿 (Vercel Cron이 `Authorization: Bearer` 헤더로 전달)

배포 후 체크리스트:

1. Firebase 콘솔 → Authentication → Settings → **승인된 도메인**에 배포 도메인 추가
2. Firebase 콘솔 → Firestore(해당 데이터베이스) → 규칙에 `firestore.rules` 내용 반영
3. 프로덕션 URL에서 로그인 → 재료 추가 → 영수증 스캔 → 추천 → **레시피 보기 → 이거 만들었어요** → 북마크 전체 플로우 확인
4. (알림 사용 시) 메뉴에서 **임박 재료 알림** 켜기 → `curl -H "Authorization: Bearer $CRON_SECRET" https://<도메인>/api/cron/expiry-digest`로 수동 테스트 → 메일 수신 확인
