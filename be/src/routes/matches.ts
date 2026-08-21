import { Router } from 'express';
import { config } from '../config';
import { currentStudentNo, requireAuth } from '../middleware/require-auth';
import { PANDORA_STAGES, jobProgress } from '../lib/jobs';
import {
  generateDateCourse,
  latestMatch,
  matchBoard,
  matchHistory,
  runMatching,
  toggleSupport,
} from '../services/matching.service';
import type { MatchDoc } from '../types/models';

export const matchesRouter = Router();

matchesRouter.use(requireAuth);

/**
 * 1위만 내려보낸다. 2위 이하는 DB에만 남는다 (PRD Q3, S-8).
 * 상대 정보는 이름·나이·MBTI와 근거에 언급된 내용으로 제한된다 (S-2).
 */
function toPublic(doc: MatchDoc) {
  const top = doc.results[0];
  return {
    id: doc._id.toHexString(),
    generatedAt: doc.generatedAt,
    isRefresh: doc.isRefresh,
    dateCourse: doc.dateCourse ?? null,
    match: {
      name: top.name,
      score: top.score,
      headline: top.headline,
      reasons: top.reasons,
      concerns: top.concerns,
      conversationStarters: top.conversationStarters,
    },
  };
}

/**
 * 저장된 최신 결과. AI를 재호출하지 않는다 (PRD F-4.2).
 * 진행 중인 작업이 있으면 progress를 함께 준다 — 화면을 떠났다 돌아와도 상태가 이어진다.
 */
matchesRouter.get('/', async (req, res) => {
  const userId = currentStudentNo(req);
  const doc = await latestMatch(userId);
  res.json({
    cost: config.match.cost,
    result: doc ? toPublic(doc) : null,
    progress: matchProgress(userId),
  });
});

/** 판도라 진행 상태는 판도라 화면 몫이라 홈에서는 감춘다. */
function matchProgress(userId: string) {
  const p = jobProgress(userId);
  return p && !PANDORA_STAGES.includes(p.stage) ? p : null;
}

/** 메인 현황보드 — 서로를 1위로 꼽은 커플만 공개된다. */
matchesRouter.get('/board', async (req, res) => {
  res.json({ couples: await matchBoard(currentStudentNo(req)) });
});

/** 지지 토글. 한 사람이 여러 커플을 지지할 수 있다. */
matchesRouter.post('/board/:pairKey/support', async (req, res) => {
  res.json(await toggleSupport(currentStudentNo(req), req.params.pairKey));
});

matchesRouter.get('/history', async (req, res) => {
  const docs = await matchHistory(currentStudentNo(req));
  res.json({ items: docs.map(toPublic) });
});

/** 매칭 실행. 최초·새로고침 모두 과금된다 (PRD F-5.2). */
matchesRouter.post('/', async (req, res) => {
  const doc = await runMatching(currentStudentNo(req));
  res.status(201).json({ result: toPublic(doc) });
});

/** 데이트 코스 생성. 매칭과 분리해 결과를 먼저 보여줄 수 있게 한다. 추가 과금 없음. */
matchesRouter.post('/date-course', async (req, res) => {
  const doc = await generateDateCourse(currentStudentNo(req));
  res.json({ result: toPublic(doc) });
});
