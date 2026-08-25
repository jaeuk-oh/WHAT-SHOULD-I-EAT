import OpenAI from 'openai';

export const INGREDIENT_CATEGORIES = ['유제품', '콩류', '채소류', '육류', '과일', '기타'] as const;

// NVIDIA NIM은 OpenAI 호환 chat completions 엔드포인트를 제공한다.
// https://integrate.api.nvidia.com/v1/chat/completions
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

export function getNvidia() {
  return new OpenAI({ apiKey: process.env.NVIDIA_API_KEY, baseURL: NVIDIA_BASE_URL });
}

/** 텍스트 추천/조리법 생성용. 빠른 응답을 위해 MoE 경량 모델을 기본으로 쓴다. */
export function getTextModel() {
  return process.env.NVIDIA_TEXT_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b';
}

/** 영수증 이미지 인식용 비전-언어 모델. */
export function getVisionModel() {
  return process.env.NVIDIA_VISION_MODEL || 'nvidia/nemotron-nano-12b-v2-vl';
}

/**
 * NVIDIA NIM 채팅 API는 OpenAI의 response_format(json_schema strict)을 지원하지 않는다.
 * 프롬프트로 "JSON만 답하라"를 강제하고, 응답에서 첫 '{'~마지막 '}' 구간만 골라 파싱한다
 * (모델이 코드펜스나 설명을 덧붙이는 경우를 방어한다). 스키마가 보장되지 않으므로
 * 각 호출부에서 필수 필드에 기본값을 채워 방어적으로 쓴다.
 */
function extractJson(content: string | null | undefined): Record<string, unknown> {
  if (!content) throw new Error('빈 응답');
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('JSON 응답을 찾지 못함');
  return JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;
}

type ChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

/**
 * 텍스트 모델(getTextModel) 호출 공통 래퍼.
 * 이 모델은 기본적으로 "생각(thinking)" 트레이스를 content에 그대로 흘려보낸다 —
 * 끄지 않으면 JSON 답 전에 긴 사고 과정이 나와 max_tokens를 다 써버리고 JSON을 못 낸다.
 * chat_template_kwargs는 OpenAI 타입에 없는 NVIDIA 전용 확장이라 타입을 넓혀서 전달한다.
 */
async function createTextCompletion(params: Omit<ChatParams, 'model'>) {
  return getNvidia().chat.completions.create({
    ...params,
    model: getTextModel(),
    chat_template_kwargs: { enable_thinking: false },
  } as ChatParams & { chat_template_kwargs: { enable_thinking: boolean } });
}

export interface ScannedItem {
  name: string;
  category: string;
  /** "1팩", "2개", "500g" 등 영수증에 적힌 수량/용량 */
  quantity: string;
  shelfLifeDays: number;
}

export interface RecommendInput {
  ingredients: { name: string; category: string; daysLeft: number }[];
  prompt?: string;
  category?: string;
  exclude?: string[];
}

export interface RecommendedRecipe {
  title: string;
  time: string;
  difficulty: string;
  servings: string;
  warning: string;
  warningType: 'alert' | 'info';
  tags: string[];
  usedIngredients: { name: string; amount: string }[];
  /** 추천 목록 카드에서는 쓰지 않는다 — 상세 화면(recipe-detail)이 따로 생성한다. 응답 속도를 위해 항상 빈 배열. */
  steps: string[];
  substitutes: { missing: string; replaceWith: string }[];
  /** 이 요리에 필요하지만 사용자에게 없는 재료 */
  missingIngredients: string[];
}

const RECOMMEND_JSON_SHAPE = `{
  "recipes": [
    {
      "title": string, "time": string, "difficulty": "아주 쉬움"|"쉬움"|"보통"|"어려움", "servings": string,
      "warning": string, "warningType": "alert"|"info", "tags": string[],
      "usedIngredients": [{"name": string, "amount": string}],
      "substitutes": [{"missing": string, "replaceWith": string}],
      "missingIngredients": string[]
    }
  ]
}`;

export async function recommendRecipes(input: RecommendInput): Promise<RecommendedRecipe[]> {
  const ingredientLines = input.ingredients
    .map((i) => `- ${i.name} (${i.category}, D-${i.daysLeft})`)
    .join('\n');

  let request =
    input.ingredients.length > 0
      ? `내 냉장고 재료 (D-day는 남은 보관일):\n${ingredientLines}\n\n`
      : '내 냉장고가 비어 있어. 편의점이나 마트에서 재료 2~3개만 사면 만들 수 있는 자취 기본 메뉴를 추천해줘.\n\n';
  if (input.category) request += `조건: "${input.category}" 스타일의 메뉴를 원해.\n`;
  if (input.prompt) request += `요청사항: ${input.prompt}\n`;
  if (input.exclude && input.exclude.length > 0) {
    request += `이미 본 메뉴라서 제외할 것: ${input.exclude.join(', ')}\n`;
  }
  request += '레시피 3~4개를 추천해줘.';

  const response = await createTextCompletion({
    temperature: 0.6,
    messages: [
      {
        role: 'system',
        content:
          '너는 1인 가구를 위한 냉장고 파먹기 요리 추천 셰프다. ' +
          '사용자의 냉장고 재료 목록을 보고 실제로 만들 수 있는 레시피를 추천한다. ' +
          '실제로 존재하고 사람들이 흔히 해먹는 요리만 추천한다 — 이름만 봐도 무슨 음식인지 알 수 있어야 하고, 존재하지 않는 재료 조합을 지어내지 않는다. ' +
          '추천 우선순위는 "사용자가 가진 재료를 최대한 많이 쓰는 레시피"가 "살 재료가 적게 필요한 레시피"보다 앞선다 — ' +
          'missingIngredients는 가능하면 0~1개로 최소화하고, 특별한 이유 없이 2개를 넘기지 않는다. ' +
          'D-2 이하 임박 재료가 있으면 그 재료를 우선 사용하는 레시피를 앞쪽에 배치하고, warning에 임박 재료를 언급하며 warningType은 alert로 한다. ' +
          '임박 재료를 쓰지 않는 레시피의 warning은 짧은 유용한 코멘트로 하고 warningType은 info로 한다. ' +
          'tags에는 그 레시피에 쓰이는 주요 재료명을 넣되 사용자가 가진 재료를 앞에 둔다. ' +
          '사용자에게 없는 재료가 꼭 필요하면 substitutes에 {missing: 없는 재료, replaceWith: 대체 재료}를 넣고, 대체 재료는 가능하면 사용자가 가진 것으로 고른다. 없으면 빈 배열. ' +
          'usedIngredients에는 이 레시피에 실제로 쓰는 재료와 1인분 기준 분량을 {name, amount} 형태로 넣고, 사용자가 가진 재료를 앞쪽에 둔다 (amount 예: "1/2개", "200g", "1큰술"). ' +
          'missingIngredients에는 이 요리에 꼭 필요하지만 사용자에게 없는 재료명만 넣는다. ' +
          '소금·후추·식용유·간장 같은 기본 조미료는 누구나 있다고 보고 missingIngredients에 넣지 않는다. ' +
          "servings는 '1인분' 형태. time은 '15분' 형태, difficulty는 '아주 쉬움'|'쉬움'|'보통'|'어려움' 중 하나. 모든 텍스트는 한국어. " +
          '조리 순서(steps)는 요구하지 않는다 — 사용자가 상세 화면을 열 때 따로 생성한다.\n\n' +
          `다른 설명 없이 아래 형식의 JSON 객체만 답한다(코드펜스 금지):\n${RECOMMEND_JSON_SHAPE}`,
      },
      { role: 'user', content: request },
    ],
  });

  const parsed = extractJson(response.choices[0]?.message?.content);
  const recipes = Array.isArray(parsed.recipes) ? (parsed.recipes as Partial<RecommendedRecipe>[]) : [];
  const mapped = recipes.map((r) => ({
    title: r.title ?? '',
    time: r.time ?? '',
    difficulty: r.difficulty ?? '보통',
    servings: r.servings ?? '1인분',
    warning: r.warning ?? '',
    warningType: r.warningType === 'alert' ? ('alert' as const) : ('info' as const),
    tags: Array.isArray(r.tags) ? r.tags : [],
    usedIngredients: Array.isArray(r.usedIngredients) ? r.usedIngredients : [],
    // 목록 카드는 steps를 쓰지 않는다 — 모델에도 요구하지 않아 응답이 빨라진다
    steps: [],
    substitutes: Array.isArray(r.substitutes) ? r.substitutes : [],
    missingIngredients: Array.isArray(r.missingIngredients) ? r.missingIngredients : [],
  }));

  // 모델이 "가진 재료 최대한 활용" 지시를 완벽히 따르지 않을 수 있어, 응답 순서를 한 번 더 보정한다.
  // 임박 재료 경고(alert)가 있는 레시피는 그대로 앞에 두고, 그 안에서는 실제로 가진 재료를
  // 많이 쓰는(=missingIngredients가 적은) 레시피를 우선한다. 동점이면 모델이 준 원래 순서를 유지한다.
  return mapped
    .map((recipe, index) => ({ recipe, index }))
    .sort((a, b) => {
      const alertDiff = (a.recipe.warningType === 'alert' ? 0 : 1) - (b.recipe.warningType === 'alert' ? 0 : 1);
      if (alertDiff !== 0) return alertDiff;
      const missingDiff = a.recipe.missingIngredients.length - b.recipe.missingIngredients.length;
      if (missingDiff !== 0) return missingDiff;
      return a.index - b.index;
    })
    .map(({ recipe }) => recipe);
}

const RECEIPT_JSON_SHAPE = `{ "items": [ { "name": string, "category": "${INGREDIENT_CATEGORIES.join('"|"')}", "quantity": string, "shelfLifeDays": integer } ] }`;

export async function scanReceiptImage(image: string): Promise<ScannedItem[]> {
  const response = await getNvidia().chat.completions.create({
    model: getVisionModel(),
    messages: [
      {
        role: 'system',
        content:
          '너는 한국 마트/편의점 영수증에서 식재료를 추출하는 도우미다. ' +
          '영수증 이미지에서 식품 항목만 추출하고, 생활용품·주류·봉투 등 식재료가 아닌 항목은 제외한다. ' +
          '각 항목의 상품명은 브랜드/용량을 뺀 간결한 재료명으로 정리한다 (예: "서울우유 1L" → "우유"). ' +
          '카테고리는 주어진 목록에서만 고른다 (예: 두부·콩나물은 콩류, 애호박·오이 등 채소는 채소류, 우유·치즈는 유제품, 계란·면·소스는 기타). ' +
          'quantity에는 영수증의 수량이나 용량을 짧게 적는다 (예: "1팩", "2개", "500g", "1L"). 알 수 없으면 "1개". ' +
          'shelfLifeDays는 일반적인 냉장 보관 기준 예상 보관일수를 정수로 추정한다.\n\n' +
          `다른 설명 없이 아래 형식의 JSON 객체만 답한다(코드펜스 금지):\n${RECEIPT_JSON_SHAPE}`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '이 영수증에서 식재료를 추출해줘.' },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ],
  });

  const parsed = extractJson(response.choices[0]?.message?.content);
  const items = Array.isArray(parsed.items) ? (parsed.items as Partial<ScannedItem>[]) : [];
  return items
    .filter((i): i is Partial<ScannedItem> & { name: string } => typeof i.name === 'string' && i.name.trim().length > 0)
    .map((i) => ({
      name: i.name.trim(),
      category: (INGREDIENT_CATEGORIES as readonly string[]).includes(i.category ?? '') ? (i.category as string) : '기타',
      quantity: (i.quantity ?? '').trim().slice(0, 20) || '1개',
      shelfLifeDays: Math.min(365, Math.max(1, Math.round(Number(i.shelfLifeDays) || 3))),
    }));
}

export interface RecipeDetailInput {
  title: string;
  ingredients: { name: string; category: string; daysLeft: number }[];
}

export interface RecipeStep {
  text: string;
  tip: string;
}

export interface RecipeDetail {
  title: string;
  summary: string;
  time: string;
  difficulty: string;
  servings: string;
  ingredients: { name: string; amount: string; owned: boolean }[];
  steps: RecipeStep[];
  tips: string[];
}

const RECIPE_DETAIL_JSON_SHAPE = `{
  "title": string, "summary": string, "time": string, "difficulty": "아주 쉬움"|"쉬움"|"보통"|"어려움", "servings": string,
  "ingredients": [{"name": string, "amount": string, "owned": boolean}],
  "steps": [{"text": string, "tip": string}],
  "tips": string[]
}`;

export async function getRecipeDetail(input: RecipeDetailInput): Promise<RecipeDetail> {
  const owned = input.ingredients.map((i) => i.name).join(', ') || '(등록된 재료 없음)';

  const response = await createTextCompletion({
    messages: [
      {
        role: 'system',
        content:
          '너는 요리 초보도 따라 할 수 있게 설명하는 셰프다. ' +
          '주어진 요리의 실제 조리법을 단계별로 알려준다. ' +
          'ingredients에는 이 요리에 필요한 재료와 분량을 적고, 사용자가 이미 가진 재료면 owned를 true로 한다. ' +
          'steps는 3~8단계로, 각 단계는 한 문장으로 명확하게 쓴다. ' +
          '불 세기·시간처럼 실패하기 쉬운 부분은 tip에 짧게 덧붙이고, 특별히 덧붙일 말이 없으면 tip은 빈 문자열로 둔다. ' +
          "time은 '15분' 형태, difficulty는 '아주 쉬움'|'쉬움'|'보통'|'어려움' 중 하나, servings는 '1인분' 형태. " +
          'tips에는 보관법이나 응용법 같은 조언을 0~3개 넣는다. 모든 텍스트는 한국어.\n\n' +
          `다른 설명 없이 아래 형식의 JSON 객체만 답한다(코드펜스 금지):\n${RECIPE_DETAIL_JSON_SHAPE}`,
      },
      {
        role: 'user',
        content: `요리 이름: ${input.title}\n내가 가진 재료: ${owned}\n\n이 요리의 조리법을 알려줘.`,
      },
    ],
  });

  const parsed = extractJson(response.choices[0]?.message?.content) as Partial<RecipeDetail>;
  return {
    title: parsed.title ?? input.title,
    summary: parsed.summary ?? '',
    time: parsed.time ?? '',
    difficulty: parsed.difficulty ?? '보통',
    servings: parsed.servings ?? '1인분',
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
    steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    tips: Array.isArray(parsed.tips) ? parsed.tips : [],
  };
}
