# 트러블슈팅 기록

프로덕션/개발 중 발생한 에러와 해결 과정을 기록한다. 새 에러를 해결하면 같은 형식으로 항목을 추가할 것.

---

## 에러 1. 영수증 인식 502 — OpenAI `invalid_api_key` (키 로테이션 누락)

**발생일**: 2026-07-15 | **상태**: ✅ 해결

### 증상

- 프로덕션(https://what-should-i-eat-jet.vercel.app)에서 영수증 사진을 올리면 인식에 실패하고 토스트 표시:
  > 영수증 인식에 실패했어요. 잠시 후 다시 시도해주세요.
- 브라우저 네트워크 탭: `POST /api/receipt-scan` → **502 Bad Gateway**
- 요청 자체는 정상 (Authorization 토큰 포함, 이미지 279KB — 401/400/413 아님 → 핸들러 내부에서 실패했다는 뜻)

### 원인 추적 과정

1. 응답 코드 분석: 이 API의 에러 체계에서 **502는 "OpenAI 호출 실패" catch 블록 전용** (401=미인증, 400=잘못된 이미지, 413=용량 초과). 즉 인증·검증은 통과했고 OpenAI 호출 단계에서 예외 발생.
2. Vercel 런타임 로그 조회:
   ```bash
   npx vercel logs https://what-should-i-eat-jet.vercel.app --json
   ```
3. 로그에서 실제 예외 확인:
   ```
   receipt-scan 실패: AuthenticationError: 401 Incorrect API key provided:
   sk-proj-****...****y9IA  (code: invalid_api_key)
   ```
4. 키 끝자리 대조: 로그의 `...y9IA`는 **최초 발급했던 구 키**. 보안상 키를 로테이션(구 키 폐기 + 새 키 발급)하면서 로컬 `.env`는 새 키로 바꿨지만, **Vercel 프로덕션 환경변수는 구 키 그대로** 남아 있었음. 폐기된 키로 OpenAI를 호출하니 401 → 서버가 502로 변환.

### 해결

```bash
# 1. 새 키가 정상인지 로컬에서 먼저 검증
npx tsx scripts/test-recommend.ts        # ✅ 추천 결과 정상 반환

# 2. Vercel 프로덕션 환경변수 교체
printf '%s' "$OPENAI_API_KEY" | npx vercel env add OPENAI_API_KEY production --force

# 3. 환경변수는 재배포해야 함수에 반영됨
npx vercel --prod --yes

# 4. 프로덕션 엔드투엔드 검증 (유효한 Firebase ID 토큰 + 테스트 영수증 이미지)
curl -X POST https://what-should-i-eat-jet.vercel.app/api/receipt-scan \
  -H "Authorization: Bearer <ID_TOKEN>" -H "Content-Type: application/json" \
  --data-binary @scan-body.json
# → 200, 식재료 8종 정상 추출 확인
```

### 교훈 / 재발 방지

- **API 키 로테이션은 "발급→모든 배포 환경 교체→재배포→구 키 폐기" 순서로.** 구 키를 먼저 폐기하면 교체 전까지 프로덕션이 죽는다. 이번엔 교체 자체를 누락했다.
- 키가 존재하는 곳 체크리스트: 로컬 `.env` + **Vercel 환경변수**(production/preview/development 각각). `npx vercel env ls`로 등록 목록·수정 시각을 확인할 수 있다.
- Vercel 환경변수는 저장만 하면 반영되지 않는다 — **반드시 재배포 필요.**
- 프로덕션 API 5xx는 추측 대신 `npx vercel logs`부터. 이 프로젝트는 핸들러가 원인별로 상태 코드를 구분(401/400/413/502)하므로 코드만으로 어느 단계 실패인지 좁힐 수 있다.

---

## 에러 2. 배포 직후 모든 API 500 — `FUNCTION_INVOCATION_FAILED` (ESM 임포트 확장자)

**발생일**: 2026-07-15 (최초 배포 직후) | **상태**: ✅ 해결

### 증상

- 첫 프로덕션 배포 후 정적 페이지는 정상(200)인데 **모든 `/api/*` 요청이 500**:
  ```
  A server error has occurred
  FUNCTION_INVOCATION_FAILED
  ```
- 인증이 필요 없는 GET 메서드 체크(405가 나와야 함)조차 500 → 핸들러 로직 진입 전, **모듈 로드 단계**에서 죽는다는 신호.

### 원인 추적 과정

1. `npx vercel logs`로 런타임 로그 확인 → `Error [ERR_MODULE_NOT_FOUND]`
2. 원인: `package.json`에 `"type": "module"`이 설정돼 있어 Vercel Node 런타임이 함수 파일을 **ESM으로 실행**하는데, ESM은 상대 임포트에 **파일 확장자가 필수**. `import { requireAuth } from './_utils'`처럼 확장자 없는 임포트가 런타임 해석에 실패.
3. 로컬(`vite`, `tsx`)은 번들러/로더가 확장자를 보정해줘서 재현되지 않았음 — 로컬과 프로덕션의 모듈 해석 방식 차이가 함정.

### 해결

`api/` 안의 상대 임포트에 `.js` 확장자 명시 (TS 파일이어도 ESM 규약상 `.js`로 쓴다):

```ts
// before
import { requireAuth } from './_utils';
// after
import { requireAuth } from './_utils.js';
```

재배포 후 401/405 등 의도된 응답 코드 확인 완료.

### 교훈 / 재발 방지

- `"type": "module"` 프로젝트에서 Vercel Functions의 상대 임포트는 **항상 `.js` 확장자**를 붙일 것 (`api/` 디렉터리에 새 파일을 추가할 때 특히 주의).
- "GET도 500"처럼 **가장 단순한 요청까지 실패하면 로직 버그가 아니라 모듈 로드/초기화 실패**를 먼저 의심한다.
- 로컬에서 통과해도 런타임(번들러 유무, CJS/ESM)이 다르면 프로덕션에서 깨질 수 있다 — 배포 직후 스모크 테스트(index 200, 미인증 API 401, GET 405)를 루틴으로 한다.
