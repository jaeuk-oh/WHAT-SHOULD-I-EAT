import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

/**
 * firestore.rules 회귀 테스트.
 *
 * 보안 규칙은 코드와 별도로 배포되는 산출물이라 타입체크·빌드로는 검증되지 않는다.
 * 실제로 `setNotifyExpiry()`가 users 문서에 쓰는 `notifyExpiry` 필드가 규칙의
 * 허용 목록에 없어서, 알림 토글과 이메일 크론이 통째로 죽어 있던 적이 있다.
 * 그 클래스를 여기서 막는다.
 *
 * 실행: npm run test:rules (Firestore 에뮬레이터 필요 — Java 런타임 필수)
 */

const PROJECT_ID = 'demo-naengteol';
const ME = 'user-me';
const OTHER = 'user-other';

let testEnv: RulesTestEnvironment;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

/** 매 테스트가 깨끗한 상태에서 시작하도록 데이터를 비운다. */
async function reset() {
  await testEnv.clearFirestore();
}

function myDb() {
  return testEnv.authenticatedContext(ME).firestore();
}

function otherDb() {
  return testEnv.authenticatedContext(OTHER).firestore();
}

function anonDb() {
  return testEnv.unauthenticatedContext().firestore();
}

describe('users/{uid} — 프로필', () => {
  it('본인 프로필을 만들 수 있다', async () => {
    await reset();
    await assertSucceeds(
      setDoc(doc(myDb(), 'users', ME), { email: 'me@example.com', displayName: '나' }),
    );
  });

  // 이 필드가 규칙에서 빠져 알림 기능 전체가 죽은 적이 있다 (src/lib/db.ts setNotifyExpiry)
  it('notifyExpiry 를 켜고 끌 수 있다', async () => {
    await reset();
    await assertSucceeds(
      setDoc(doc(myDb(), 'users', ME), { notifyExpiry: true }, { merge: true }),
    );
    await assertSucceeds(
      setDoc(doc(myDb(), 'users', ME), { notifyExpiry: false }, { merge: true }),
    );
  });

  it('notifyExpiry 가 불리언이 아니면 거부한다', async () => {
    await reset();
    await assertFails(
      setDoc(doc(myDb(), 'users', ME), { notifyExpiry: 'yes' }, { merge: true }),
    );
  });

  it('허용 목록에 없는 필드는 거부한다', async () => {
    await reset();
    await assertFails(setDoc(doc(myDb(), 'users', ME), { role: 'admin' }, { merge: true }));
  });

  it('남의 프로필은 읽지도 쓰지도 못한다', async () => {
    await reset();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', OTHER), { email: 'other@example.com' });
    });
    await assertFails(getDoc(doc(myDb(), 'users', OTHER)));
    await assertFails(setDoc(doc(myDb(), 'users', OTHER), { displayName: '침입' }, { merge: true }));
  });
});

describe('users/{uid}/ingredients — 재료', () => {
  const valid = {
    name: '두부',
    category: '콩류',
    quantity: '1모',
    expiresAt: Timestamp.fromDate(new Date('2026-09-01')),
    createdAt: Timestamp.now(),
  };

  it('본인 재료를 등록할 수 있다', async () => {
    await reset();
    await assertSucceeds(setDoc(doc(myDb(), 'users', ME, 'ingredients', 'i1'), valid));
  });

  it('정의되지 않은 카테고리는 거부한다', async () => {
    await reset();
    await assertFails(
      setDoc(doc(myDb(), 'users', ME, 'ingredients', 'i1'), { ...valid, category: '주류' }),
    );
  });

  it('남의 재료는 등록할 수 없다', async () => {
    await reset();
    await assertFails(setDoc(doc(myDb(), 'users', OTHER, 'ingredients', 'i1'), valid));
  });
});

describe('users/{uid}/history — 소진 기록', () => {
  const entry = { name: '두부', category: '콩류', action: 'eaten', at: Timestamp.now() };

  it('기록을 남길 수 있다', async () => {
    await reset();
    await assertSucceeds(setDoc(doc(myDb(), 'users', ME, 'history', 'h1'), entry));
  });

  it('한 번 남긴 기록은 고칠 수 없다 — 절약 리포트의 신뢰성', async () => {
    await reset();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ME, 'history', 'h1'), entry);
    });
    await assertFails(updateDoc(doc(myDb(), 'users', ME, 'history', 'h1'), { action: 'discarded' }));
  });

  it('정의되지 않은 action 은 거부한다', async () => {
    await reset();
    await assertFails(
      setDoc(doc(myDb(), 'users', ME, 'history', 'h1'), { ...entry, action: 'thrown' }),
    );
  });
});

describe('users/{uid}/notifications — 알림함', () => {
  const notif = { title: '곧 상하는 재료 2개가 있어요', body: '두부(D-1), 계란(오늘까지) — 먼저 써보세요.', read: false, at: Timestamp.now() };

  it('클라이언트는 알림을 만들 수 없다 — 크론(Admin SDK)만 쓴다', async () => {
    await reset();
    await assertFails(setDoc(doc(myDb(), 'users', ME, 'notifications', 'n1'), notif));
  });

  it('본인 알림은 읽을 수 있다', async () => {
    await reset();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ME, 'notifications', 'n1'), notif);
    });
    await assertSucceeds(getDoc(doc(myDb(), 'users', ME, 'notifications', 'n1')));
  });

  it('read 필드만 바꿔 읽음 처리할 수 있다', async () => {
    await reset();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ME, 'notifications', 'n1'), notif);
    });
    await assertSucceeds(
      setDoc(doc(myDb(), 'users', ME, 'notifications', 'n1'), { read: true }, { merge: true }),
    );
  });

  it('read 외의 필드는 고칠 수 없다 — 내용 조작 차단', async () => {
    await reset();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ME, 'notifications', 'n1'), notif);
    });
    await assertFails(
      updateDoc(doc(myDb(), 'users', ME, 'notifications', 'n1'), { title: '조작된 제목' }),
    );
  });

  it('본인 알림은 지울 수 있다', async () => {
    await reset();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ME, 'notifications', 'n1'), notif);
    });
    await assertSucceeds(deleteDoc(doc(myDb(), 'users', ME, 'notifications', 'n1')));
  });

  it('남의 알림은 읽지도 지우지도 못한다', async () => {
    await reset();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', OTHER, 'notifications', 'n1'), notif);
    });
    await assertFails(getDoc(doc(myDb(), 'users', OTHER, 'notifications', 'n1')));
    await assertFails(deleteDoc(doc(myDb(), 'users', OTHER, 'notifications', 'n1')));
  });
});

describe('usage/{uid} — 사용량 카운터', () => {
  it('본인 잔여 횟수는 읽을 수 있다', async () => {
    await reset();
    await assertSucceeds(getDoc(doc(myDb(), 'usage', ME)));
  });

  it('클라이언트는 쓸 수 없다 — 쿼터 우회 차단', async () => {
    await reset();
    await assertFails(setDoc(doc(myDb(), 'usage', ME), { dayCount: 0 }));
  });

  it('남의 카운터는 읽을 수 없다', async () => {
    await reset();
    await assertFails(getDoc(doc(myDb(), 'usage', OTHER)));
  });
});

describe('youtubeCache — 서버 전용', () => {
  it('클라이언트는 읽지도 쓰지도 못한다', async () => {
    await reset();
    await assertFails(getDoc(doc(myDb(), 'youtubeCache', 'q1')));
    await assertFails(setDoc(doc(myDb(), 'youtubeCache', 'q1'), { videos: [] }));
  });
});

describe('recipes/{id} — 공유 레시피', () => {
  async function seedRecipe(likes = 3) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'recipes', 'r1'), {
        title: '김치찌개',
        author: '집밥연구소',
        type: 'community',
        tags: ['한식'],
        likes,
      });
    });
  }

  async function seedLikeMarker() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ME, 'likes', 'r1'), { createdAt: Timestamp.now() });
    });
  }

  it('로그인하지 않아도 읽을 수 있다', async () => {
    await reset();
    await seedRecipe();
    await assertSucceeds(getDoc(doc(anonDb(), 'recipes', 'r1')));
  });

  it('클라이언트는 레시피를 만들거나 지울 수 없다 — 스팸 등록 차단', async () => {
    await reset();
    await seedRecipe();
    await assertFails(setDoc(doc(myDb(), 'recipes', 'r2'), { title: '스팸', likes: 0 }));
    await assertFails(deleteDoc(doc(myDb(), 'recipes', 'r1')));
  });

  it('좋아요는 정확히 +1 만 허용한다', async () => {
    await reset();
    await seedRecipe(3);
    await assertSucceeds(updateDoc(doc(myDb(), 'recipes', 'r1'), { likes: 4 }));
  });

  it('한 번에 2 이상 올릴 수 없다 — 카운트 조작 차단', async () => {
    await reset();
    await seedRecipe(3);
    await assertFails(updateDoc(doc(myDb(), 'recipes', 'r1'), { likes: 5 }));
  });

  it('좋아요와 함께 다른 필드를 바꿀 수 없다', async () => {
    await reset();
    await seedRecipe(3);
    await assertFails(updateDoc(doc(myDb(), 'recipes', 'r1'), { likes: 4, title: '덮어쓰기' }));
  });

  it('이미 누른 사람은 또 올릴 수 없다 — 중복 좋아요 차단', async () => {
    await reset();
    await seedRecipe(3);
    await seedLikeMarker();
    await assertFails(updateDoc(doc(myDb(), 'recipes', 'r1'), { likes: 4 }));
  });

  it('이미 누른 사람은 취소(-1)할 수 있다', async () => {
    await reset();
    await seedRecipe(3);
    await seedLikeMarker();
    await assertSucceeds(updateDoc(doc(myDb(), 'recipes', 'r1'), { likes: 2 }));
  });

  it('로그인하지 않으면 좋아요를 누를 수 없다', async () => {
    await reset();
    await seedRecipe(3);
    await assertFails(updateDoc(doc(anonDb(), 'recipes', 'r1'), { likes: 4 }));
  });
});
