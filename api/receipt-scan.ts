import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard } from './_utils.js';
import { scanReceiptImage } from './_core.js';

// base64 data URL 기준 약 4.5MB (클라이언트에서 1280px JPEG로 압축해 전송)
const MAX_IMAGE_LENGTH = 6_000_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const uid = await guard(req, res, 'receiptScan');
  if (!uid) return;

  const { image } = (req.body ?? {}) as { image?: unknown };
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: '이미지 데이터가 필요합니다.' });
  }
  if (image.length > MAX_IMAGE_LENGTH) {
    return res.status(413).json({ error: '이미지가 너무 큽니다. 더 작은 사진으로 시도해주세요.' });
  }

  try {
    const items = await scanReceiptImage(image);
    return res.status(200).json({ items });
  } catch (e) {
    console.error('receipt-scan 실패:', e);
    return res.status(502).json({ error: '영수증 인식에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
}
