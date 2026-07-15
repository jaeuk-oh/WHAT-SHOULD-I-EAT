// 로컬 개발용 API 서버: Vercel Functions 핸들러를 express로 감싸 vite 프록시(/api)로 노출한다.
import 'dotenv/config';
import express from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import receiptScan from '../api/receipt-scan';

const app = express();
app.use(express.json({ limit: '8mb' }));

const adapt =
  (handler: (req: VercelRequest, res: VercelResponse) => Promise<unknown>) =>
  (req: express.Request, res: express.Response) => {
    void handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
  };

app.post('/api/receipt-scan', adapt(receiptScan));

const port = 3001;
app.listen(port, () => console.log(`로컬 API 서버: http://localhost:${port}`));
