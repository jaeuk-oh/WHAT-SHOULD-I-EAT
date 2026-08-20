import OpenAI from 'openai';

export const INGREDIENT_CATEGORIES = ['유제품', '콩류', '채소류', '육류', '과일', '기타'] as const;

export function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function getModel() {
  return process.env.OPENAI_MODEL || 'gpt-4.1-mini';
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
  steps: string[];
  substitutes: { missing: string; replaceWith: string }[];
  /** 이 요리에 필요하지만 사용자에게 없는 재료 */
  missingIngredients: string[];
}

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

  const response = await getOpenAI().chat.completions.create({
    model: getModel(),
    messages: [
      {
        role: 'system',
        content:
          '너는 1인 가구를 위한 냉장고 파먹기 요리 추천 셰프다. ' +
          '사용자의 냉장고 재료 목록을 보고 실제로 만들 수 있는 레시피를 추천한다. ' +
          'D-2 이하 임박 재료가 있으면 그 재료를 우선 사용하는 레시피를 앞쪽에 배치하고, warning에 임박 재료를 언급하며 warningType은 alert로 한다. ' +
          '임박 재료를 쓰지 않는 레시피의 warning은 짧은 유용한 코멘트로 하고 warningType은 info로 한다. ' +
          'tags에는 그 레시피에 쓰이는 주요 재료명을 넣되 사용자가 가진 재료를 앞에 둔다. ' +
          '사용자에게 없는 재료가 꼭 필요하면 substitutes에 {missing: 없는 재료, replaceWith: 대체 재료}를 넣고, 대체 재료는 가능하면 사용자가 가진 것으로 고른다. 없으면 빈 배열. ' +
          'usedIngredients에는 이 레시피에 실제로 쓰는 재료와 1인분 기준 분량을 {name, amount} 형태로 넣고, 사용자가 가진 재료를 앞쪽에 둔다 (amount 예: "1/2개", "200g", "1큰술"). ' +
          'missingIngredients에는 이 요리에 꼭 필요하지만 사용자에게 없는 재료명만 넣는다. ' +
          '소금·후추·식용유·간장 같은 기본 조미료는 누구나 있다고 보고 missingIngredients에 넣지 않는다. ' +
          'steps에는 실제로 따라 할 수 있는 조리 과정을 3~8단계로, 각 단계를 한 문장으로 넣는다 (번호는 붙이지 않는다). ' +
          "servings는 '1인분' 형태. time은 '15분' 형태, difficulty는 '아주 쉬움'|'쉬움'|'보통'|'어려움' 중 하나. 모든 텍스트는 한국어.",
      },
      { role: 'user', content: request },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'recipe_recommendations',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            recipes: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  title: { type: 'string' },
                  time: { type: 'string' },
                  difficulty: { type: 'string', enum: ['아주 쉬움', '쉬움', '보통', '어려움'] },
                  servings: { type: 'string' },
                  warning: { type: 'string' },
                  warningType: { type: 'string', enum: ['alert', 'info'] },
                  tags: { type: 'array', items: { type: 'string' } },
                  usedIngredients: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        name: { type: 'string' },
                        amount: { type: 'string' },
                      },
                      required: ['name', 'amount'],
                    },
                  },
                  steps: { type: 'array', items: { type: 'string' } },
                  substitutes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        missing: { type: 'string' },
                        replaceWith: { type: 'string' },
                      },
                      required: ['missing', 'replaceWith'],
                    },
                  },
                  missingIngredients: { type: 'array', items: { type: 'string' } },
                },
                required: [
                  'title', 'time', 'difficulty', 'servings', 'warning', 'warningType', 'tags',
                  'usedIngredients', 'steps', 'substitutes', 'missingIngredients',
                ],
              },
            },
          },
          required: ['recipes'],
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('빈 응답');
  const parsed = JSON.parse(content) as { recipes: RecommendedRecipe[] };
  return parsed.recipes;
}

export async function scanReceiptImage(image: string): Promise<ScannedItem[]> {
  const response = await getOpenAI().chat.completions.create({
    model: getModel(),
    messages: [
      {
        role: 'system',
        content:
          '너는 한국 마트/편의점 영수증에서 식재료를 추출하는 도우미다. ' +
          '영수증 이미지에서 식품 항목만 추출하고, 생활용품·주류·봉투 등 식재료가 아닌 항목은 제외한다. ' +
          '각 항목의 상품명은 브랜드/용량을 뺀 간결한 재료명으로 정리한다 (예: "서울우유 1L" → "우유"). ' +
          '카테고리는 주어진 목록에서만 고른다 (예: 두부·콩나물은 콩류, 애호박·오이 등 채소는 채소류, 우유·치즈는 유제품, 계란·면·소스는 기타). ' +
          'quantity에는 영수증의 수량이나 용량을 짧게 적는다 (예: "1팩", "2개", "500g", "1L"). 알 수 없으면 "1개". ' +
          'shelfLifeDays는 일반적인 냉장 보관 기준 예상 보관일수를 정수로 추정한다.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '이 영수증에서 식재료를 추출해줘.' },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'receipt_items',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string', enum: [...INGREDIENT_CATEGORIES] },
                  quantity: { type: 'string' },
                  shelfLifeDays: { type: 'integer' },
                },
                required: ['name', 'category', 'quantity', 'shelfLifeDays'],
              },
            },
          },
          required: ['items'],
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('빈 응답');
  const parsed = JSON.parse(content) as { items: ScannedItem[] };
  return parsed.items
    .filter((i) => i.name.trim().length > 0)
    .map((i) => ({
      name: i.name.trim(),
      category: (INGREDIENT_CATEGORIES as readonly string[]).includes(i.category) ? i.category : '기타',
      quantity: (i.quantity ?? '').trim().slice(0, 20) || '1개',
      shelfLifeDays: Math.min(365, Math.max(1, Math.round(i.shelfLifeDays))),
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

export async function getRecipeDetail(input: RecipeDetailInput): Promise<RecipeDetail> {
  const owned = input.ingredients.map((i) => i.name).join(', ') || '(등록된 재료 없음)';

  const response = await getOpenAI().chat.completions.create({
    model: getModel(),
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
          'tips에는 보관법이나 응용법 같은 조언을 0~3개 넣는다. 모든 텍스트는 한국어.',
      },
      {
        role: 'user',
        content: `요리 이름: ${input.title}\n내가 가진 재료: ${owned}\n\n이 요리의 조리법을 알려줘.`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'recipe_detail',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            time: { type: 'string' },
            difficulty: { type: 'string', enum: ['아주 쉬움', '쉬움', '보통', '어려움'] },
            servings: { type: 'string' },
            ingredients: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  amount: { type: 'string' },
                  owned: { type: 'boolean' },
                },
                required: ['name', 'amount', 'owned'],
              },
            },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  text: { type: 'string' },
                  tip: { type: 'string' },
                },
                required: ['text', 'tip'],
              },
            },
            tips: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'summary', 'time', 'difficulty', 'servings', 'ingredients', 'steps', 'tips'],
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('빈 응답');
  return JSON.parse(content) as RecipeDetail;
}
