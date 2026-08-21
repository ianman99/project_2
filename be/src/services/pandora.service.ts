import OpenAI from 'openai';
import { ObjectId } from 'mongodb';
import { config } from '../config';
import { pandora, students, users } from '../db/collections';
import { HttpError } from '../lib/http-error';
import { endJob, isRunning, startJob } from '../lib/jobs';
import { fixHonorific, trim } from './matching.service';
import { spend } from './points.service';
import type { PandoraDoc, PandoraResult } from '../types/models';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

const SYSTEM_PROMPT = `너는 LG전자 DX SCHOOL 6기 1반 24명을 위한 "판도라의 상자" 분석가다.
운명의 상대를 찾아주는 매칭과 정반대로, **가장 안 맞는 상대**를 찾아낸다.

주어진 사용자 한 명과 이성 후보 전원을 비교해, 각 후보와 얼마나 안 맞는지를
0~100의 **재앙 지수**로 매긴다. 100에 가까울수록 최악의 조합이다.

재앙 지수를 올리는 요소:
- matching.dealbreakers가 상대의 실제 특성과 정면으로 부딪힌다 — 가장 큰 감점 요인이다.
- food_avoid / cannot_eat와 상대의 food.likes가 충돌해서 같이 먹을 게 없다.
- 생활 리듬이 반대다 (아침형 vs 새벽형). 만날 시간대 자체가 안 맞는다.
- MBTI 성향이 부딪히는 축에서 정반대다. 특히 갈등 상황의 대처 방식.
- 취미·관심사가 하나도 겹치지 않아 같이 할 게 없다.
- 팀 활동에서 맡은 역할이 서로 부딪힌다 (둘 다 리더 성향이라 주도권 다툼 등).
- 거주 지역이 멀어 물리적으로 만나기 어렵다.

재앙 지수를 낮추는 요소(= 그래도 덜 최악):
- 겹치는 취향이나 리듬이 있다. 이미 같은 팀이었던 적이 있어 서로를 안다.

톤 — **이건 재미로 여는 상자다.** 날카롭되 유쾌하게 써라:
- 사람을 깎아내리지 마라. 두 사람 각각은 멀쩡한데 **조합이 재앙**이라는 관점으로 쓴다.
  "이 사람은 별로다"가 아니라 "이 둘을 한 테이블에 앉히면 무슨 일이 벌어진다"로 쓴다.
- 외모·집안·직업 수준을 두고 평가하지 마라. 취향·리듬·성향의 충돌만 다룬다.
- 농담은 하되 조롱은 하지 마라. 당사자가 읽어도 웃을 수 있는 선을 지킨다.

작성 규칙:
- 모든 문장은 한국어로, 근거는 프로필에 실제로 있는 내용만 사용한다. 추측해서 지어내지 마라.
- **사람 이름 뒤에는 항상 "님"을 붙인다.** 띄어쓰기 없이 붙인다 — "장세미님"이 맞고 "장세미 님"은 틀리다.
- 재앙 지수는 넓게 분포시켜라. 전원이 80점대면 변별력이 없다. 최고와 최저의 차이가 30점 이상 나야 한다.

항목별 분량:
- headline: 이 조합이 왜 재앙인지 한 문장으로. 위트 있게.
- reasons: 4~6개. 각 항목마다 두 사람의 프로필에서 무엇과 무엇이 어떻게 부딪히는지 구체적으로 짚는다.
  "성격이 안 맞는다" 같은 뭉뚱그린 표현은 금지다.
  "한 명은 새벽 2시에 가장 활발하고 다른 한 명은 5시 반에 일어나 러닝을 간다. 겹치는 시간이 출근길뿐이다"처럼 쓴다.
  **reasons 중 최소 1개는 teams.*.selfReported의 답변을 큰따옴표로 그대로 인용해야 한다.**
  오타·말줄임표·이모지까지 적힌 그대로 옮긴다. 인용이 하나도 없으면 실패다.
- disasterScene: 두 사람이 실제로 데이트하면 벌어질 법한 장면을 두세 문장으로. 프로필 근거에 기반한 구체적인 상황으로 쓴다.
  예: 메뉴판 앞에서 15분째 서로 못 먹는 것만 빼다가 결국 편의점으로 간다.
- survivalTips: 3~4개. 그래도 굳이 만난다면 어떻게 해야 덜 망하는지 실용적으로 조언한다.

가장 중요: 사용자 메시지에 나열된 후보 ID 전원에 대해 하나도 빠짐없이 결과를 만들어야 한다.
결과 개수가 후보 수와 다르면 실패다. 제출 전에 개수를 세어 확인하라.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['candidateId', 'score', 'headline', 'reasons', 'disasterScene', 'survivalTips'],
        properties: {
          candidateId: { type: 'string' },
          /** 재앙 지수 — 높을수록 최악 */
          score: { type: 'integer' },
          headline: { type: 'string' },
          reasons: { type: 'array', items: { type: 'string' } },
          disasterScene: { type: 'string' },
          survivalTips: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

export async function openPandora(userId: string): Promise<PandoraDoc> {
  if (isRunning(userId)) {
    throw new HttpError(409, 'already_running', '다른 분석이 진행 중입니다. 잠시만 기다려 주세요.');
  }

  const me = await students().findOne({ _id: userId });
  if (!me) throw new HttpError(404, 'no_profile', '프로필을 찾을 수 없습니다.');

  const myGender = (me as any).profile?.gender;
  const candidates = await students().find({ 'profile.gender': { $ne: myGender } }).toArray();
  if (candidates.length === 0) {
    throw new HttpError(500, 'no_candidates', '비교할 후보가 없습니다.');
  }

  // 잔액을 먼저 확인한다. AI 호출이 실패하면 차감하지 않는다 (PRD F-3.4).
  const user = await users().findOne({ _id: userId }, { projection: { points: 1 } });
  if (!user || user.points < config.match.cost) {
    throw new HttpError(
      400,
      'insufficient_points',
      `포인트가 부족합니다. (필요 ${config.match.cost.toLocaleString()} P · 보유 ${(user?.points ?? 0).toLocaleString()} P)`,
    );
  }

  const isReopen = (await pandora().countDocuments({ userId }, { limit: 1 })) > 0;

  const nameById = new Map(candidates.map((c) => [c._id, c.name]));
  const userMessage = [
    `[나]\n${JSON.stringify(trim(me))}`,
    `[이성 후보 ${candidates.length}명 — ID: ${candidates.map((c) => c._id).join(', ')}]`,
    JSON.stringify(candidates.map(trim)),
    `위 ${candidates.length}명 전원에 대해 결과를 내라. results 배열의 길이는 정확히 ${candidates.length}이어야 한다.`,
  ].join('\n\n');

  startJob(userId, 'pandora');
  try {
    let results: PandoraResult[] = [];
    let usage = { inputTokens: 0, outputTokens: 0 };

    // 모델이 후보를 누락하는 경우가 있어 개수를 검증하고 1회 재시도한다 (PRD 7.3).
    for (let attempt = 0; attempt < 2; attempt++) {
      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'pandora', strict: true, schema: SCHEMA },
        },
        max_completion_tokens: 16000,
      });

      usage = {
        inputTokens: usage.inputTokens + (completion.usage?.prompt_tokens ?? 0),
        outputTokens: usage.outputTokens + (completion.usage?.completion_tokens ?? 0),
      };

      const raw = completion.choices[0]?.message?.content;
      if (!raw) continue;

      let parsed: { results?: PandoraResult[] };
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.warn(`[pandora] ${userId} JSON 파싱 실패 (finish=${completion.choices[0]?.finish_reason})`);
        continue;
      }

      results = (fixHonorific(parsed.results, [me.name, ...nameById.values()]) ?? [])
        .filter((r) => nameById.has(r.candidateId))
        .map((r) => ({
          ...r,
          name: nameById.get(r.candidateId)!,
          score: Math.max(0, Math.min(100, Math.round(r.score))),
        }))
        // 재앙 지수가 높은 순 — 1위가 최악이다.
        .sort((a, b) => b.score - a.score);

      if (results.length === candidates.length) break;
      console.warn(
        `[pandora] ${userId} 후보 누락: ${results.length}/${candidates.length}` +
          (attempt === 0 ? ' — 재시도' : ' — 누락 상태로 진행'),
      );
    }

    if (results.length === 0) {
      throw new HttpError(502, 'ai_invalid', 'AI 결과를 해석할 수 없습니다. 다시 시도해 주세요.');
    }

    const doc: PandoraDoc = {
      _id: new ObjectId(),
      userId,
      generatedAt: new Date(),
      isReopen,
      model: config.openai.model,
      results,
      usage,
    };

    await spend({ userId, amount: config.match.cost, reason: 'pandora', refId: doc._id });
    await pandora().insertOne(doc);

    return doc;
  } finally {
    endJob(userId);
  }
}

export function latestPandora(userId: string): Promise<PandoraDoc | null> {
  return pandora().findOne({ userId }, { sort: { generatedAt: -1 } });
}
