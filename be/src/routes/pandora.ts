import { Router } from 'express';
import { config } from '../config';
import { PANDORA_STAGES, jobProgress } from '../lib/jobs';
import { currentStudentNo, requireAuth } from '../middleware/require-auth';
import { latestPandora, openPandora } from '../services/pandora.service';
import type { PandoraDoc } from '../types/models';

export const pandoraRouter = Router();

pandoraRouter.use(requireAuth);

/** 최악 1위만 내려보낸다. 2위 이하는 DB에만 남는다 (PRD S-8과 같은 원칙). */
function toPublic(doc: PandoraDoc) {
  const worst = doc.results[0];
  return {
    id: doc._id.toHexString(),
    generatedAt: doc.generatedAt,
    isReopen: doc.isReopen,
    worst: {
      name: worst.name,
      score: worst.score,
      headline: worst.headline,
      reasons: worst.reasons,
      disasterScene: worst.disasterScene,
      survivalTips: worst.survivalTips,
    },
  };
}

/** 판도라 화면의 진행 상태만 준다. 매칭이 돌고 있으면 여기서는 안 보인다. */
function pandoraProgress(userId: string) {
  const p = jobProgress(userId);
  return p && PANDORA_STAGES.includes(p.stage) ? p : null;
}

pandoraRouter.get('/', async (req, res) => {
  const userId = currentStudentNo(req);
  const doc = await latestPandora(userId);
  res.json({
    cost: config.match.cost,
    result: doc ? toPublic(doc) : null,
    progress: pandoraProgress(userId),
  });
});

pandoraRouter.post('/', async (req, res) => {
  const doc = await openPandora(currentStudentNo(req));
  res.status(201).json({ result: toPublic(doc) });
});
