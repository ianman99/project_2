import { Router } from 'express';
import { pingDb } from '../db';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  await pingDb();
  res.json({ status: 'ok' });
});
