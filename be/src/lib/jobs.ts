/**
 * 진행 중인 AI 작업 추적.
 * 사용자당 하나만 돌게 해서 중복 과금을 막고(PRD F-3.5), 화면에 진행률을 보여준다.
 */

/** 단계별 라벨과 예상 소요 시간(ms). 실측 기반 추정치다. */
export const STAGES = {
  matching: { label: '프로필 24명을 읽고 궁합을 분석하는 중', estimatedMs: 100_000 },
  course_search: { label: '홍대에서 실제 영업 중인 가게를 검색하는 중', estimatedMs: 60_000 },
  course_shaping: { label: '동선에 맞춰 코스를 짜는 중', estimatedMs: 30_000 },
  pandora: { label: '상자를 여는 중 — 최악의 조합을 찾고 있습니다', estimatedMs: 100_000 },
} as const;

export type Stage = keyof typeof STAGES;

/** 판도라 진행 상태는 판도라 화면에만, 매칭은 홈에만 보여준다. */
export const PANDORA_STAGES: Stage[] = ['pandora'];

interface Job {
  stage: Stage;
  startedAt: number;
}

const jobs = new Map<string, Job>();

export const isRunning = (userId: string) => jobs.has(userId);
export const startJob = (userId: string, stage: Stage) =>
  jobs.set(userId, { stage, startedAt: Date.now() });
export const endJob = (userId: string) => jobs.delete(userId);

export const setStage = (userId: string, stage: Stage) => {
  if (jobs.has(userId)) jobs.set(userId, { stage, startedAt: Date.now() });
};

/** 화면에 보여줄 진행 상태. 없으면 null. */
export function jobProgress(userId: string) {
  const job = jobs.get(userId);
  if (!job) return null;

  const { label, estimatedMs } = STAGES[job.stage];
  const elapsedMs = Date.now() - job.startedAt;
  // 예상 시간을 넘겨도 95%에서 멈춘다 — 다 됐다고 오해하게 두지 않는다.
  const percent = Math.min(95, Math.round((elapsedMs / estimatedMs) * 100));
  return { stage: job.stage, label, percent, elapsedMs };
}
