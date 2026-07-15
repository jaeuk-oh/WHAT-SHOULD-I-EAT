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
  shelfLifeDays: number;
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
                  shelfLifeDays: { type: 'integer' },
                },
                required: ['name', 'category', 'shelfLifeDays'],
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
      shelfLifeDays: Math.min(365, Math.max(1, Math.round(i.shelfLifeDays))),
    }));
}
