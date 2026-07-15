// 영수증 인식 코어 로직 단독 테스트: tsx scripts/test-scan.ts <이미지 경로>
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { scanReceiptImage } from '../api/_core';

const path = process.argv[2];
if (!path) {
  console.error('사용법: tsx scripts/test-scan.ts <이미지 경로>');
  process.exit(1);
}

const b64 = readFileSync(path).toString('base64');
const ext = path.endsWith('.png') ? 'png' : 'jpeg';
const dataUrl = `data:image/${ext};base64,${b64}`;

scanReceiptImage(dataUrl)
  .then((items) => {
    console.log(JSON.stringify(items, null, 2));
  })
  .catch((e) => {
    console.error('실패:', e);
    process.exit(1);
  });
