// 로컬 개발용 API 서버: Vercel Functions 핸들러를 express로 감싸 vite 프록시(/api)로 노출한다.
import 'dotenv/config';
import express from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import receiptScan from '../api/receipt-scan';
import recommend from '../api/recommend';
import recipeDetail from '../api/recipe-detail';
import accountDelete from '../api/account-delete';
import youtubeRecipes from '../api/youtube-recipes';
import expiryNotify from '../api/cron/expiry-notify';

const app = express();
app.use(express.json({ limit: '8mb' }));

const adapt =
  (handler: (req: VercelRequest, res: VercelResponse) => Promise<unknown>) =>
  (req: express.Request, res: express.Response) => {
    void handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
  };

app.post('/api/receipt-scan', adapt(receiptScan));
app.post('/api/recommend', adapt(recommend));
app.post('/api/recipe-detail', adapt(recipeDetail));
app.post('/api/account-delete', adapt(accountDelete));
app.post('/api/youtube-recipes', adapt(youtubeRecipes));
// 크론 함수 로컬 테스트용 (실제로는 Vercel Cron이 호출): CRON_SECRET 헤더 필요
app.get('/api/cron/expiry-notify', adapt(expiryNotify));

const port = 3001;
app.listen(port, () => console.log(`로컬 API 서버: http://localhost:${port}`));
