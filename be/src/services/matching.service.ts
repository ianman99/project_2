import OpenAI from 'openai';
import { ObjectId } from 'mongodb';
import { config } from '../config';
import { matches, students, users } from '../db/collections';
import { HttpError } from '../lib/http-error';
import { endJob, isRunning, setStage, startJob, type Stage } from '../lib/jobs';
import { spend } from './points.service';
import type { DateCourse, MatchDoc, MatchResult } from '../types/models';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * "곽소윤 님"처럼 띄어 쓴 호칭을 "곽소윤님"으로 붙인다.
 * 프롬프트로 지시해도 가끔 새어나가서 저장 직전에 한 번 더 정리한다.
 */
export function fixHonorific<T>(value: T, names: string[]): T {
  const targets = names.filter(Boolean);
  if (targets.length === 0) return value;

  let json = JSON.stringify(value);
  for (const name of targets) {
    // 한글 이름이라 정규식 특수문자가 없다. 이름 + 공백 + 님만 붙인다.
    json = json.split(`${name} 님`).join(`${name}님`);
  }
  return JSON.parse(json) as T;
}

/**
 * AI에 넘길 프로필을 추린다.
 * phone은 어떤 경로로도 나가면 안 된다 (PRD S-1). cohort/teams 상세/메타도 제외한다.
 */
export function trim(doc: any) {
  const p = doc.profile ?? {};
  return {
    id: doc._id,
    name: doc.name,
    bio: doc.bio,
    gender: p.gender,
    age: p.age_korean,
    mbti: p.mbti,
    major: p.major,
    residence: p.residence?.district,
    career: doc.career,
    interests: doc.interests,
    food: doc.food,
    lifestyle: doc.lifestyle,
    tmi: doc.tmi,
    qna: doc.qna,
    teams: compactTeams(doc.teams),
    matching: doc.matching,
  };
}

/**
 * 3차에 걸친 팀 활동에서 매칭에 쓸 부분만 추린다.
 * teammates 목록은 matching.teamed_with_ids와 중복이라 뺀다 — 토큰만 3배로 먹는다.
 */
function compactTeams(teams: any) {
  if (!teams) return null;
  const pick = (t: any) =>
    t
      ? {
          team: t.team_name,
          role: t.role,
          isLeader: t.is_leader,
          // 각 라운드에서 본인이 직접 적은 답변
          selfReported: t.self_reported_in_this_round,
        }
      : null;
  return { bx: pick(teams.bx), cx: pick(teams.cx), dx: pick(teams.dx) };
}

const SYSTEM_PROMPT = `너는 LG전자 DX SCHOOL 6기 1반 24명을 위한 커플 매칭 분석가다.

주어진 사용자 한 명과 이성 후보 전원을 비교해, 각 후보와 얼마나 잘 맞는지 0~100 점수와 그 근거를 낸다.

판단 기준:
- MBTI, 취미, 음식 취향, 생활 리듬, 희망 직무, 거주 지역의 실제 겹침을 본다.
- matching.dealbreakers와 food_avoid가 상대의 선호와 충돌하면 감점하고 concerns에 명시한다.
- matching.never_teamed_with_ids에 있는 후보는 아직 서로 만날 기회가 없었던 사람이다. 새로운 인연이라는 점을 근거에 활용해도 좋다.
- teams.*.selfReported는 각 팀 활동 라운드에서 **본인이 직접 손으로 적은 답변**이다. 정제된 프로필보다 이쪽이 그 사람의 진짜 목소리에 가깝다.
  말투, 사소한 취향, 농담까지 드러나므로 근거로 쓸 때 우선순위를 높게 두고 원문 표현을 인용해도 좋다.
- teams.*.role과 isLeader는 팀에서 실제로 맡은 역할이다. 리더십·책임감·성향을 판단하는 근거가 된다.
  세 라운드의 역할 변화를 보면 그 사람이 어떤 자리에서 편안한지 읽을 수 있다.
- 점수는 반드시 넓게 분포시켜라. 후보 전원이 80점대면 변별력이 없다. 최고점과 최저점의 차이가 30점 이상 나도록 하라.

작성 규칙:
- 모든 문장은 한국어로, 근거는 프로필에 실제로 있는 내용만 사용한다. 추측해서 지어내지 마라.
- headline은 왜 잘 맞는지 한 문장으로 요약한다.
- **사람 이름 뒤에는 항상 "님"을 붙인다.** 사용자 본인과 후보 모두 예외 없다.
  "장세미는" 대신 "장세미님은", "지인환과" 대신 "지인환님과"처럼 쓴다.
  **띄어쓰기 없이 이름에 바로 붙인다.** "장세미님"이 맞고 "장세미 님"은 틀리다.
  조사는 "님" 뒤에 자연스럽게 붙인다 (님은/님이/님과/님에게/님께서).

분량과 깊이 — 각 항목은 두세 문장으로 충분히 풀어 쓴다. 한 줄짜리 요약은 쓰지 마라:
- reasons: 5~7개. 각 항목마다 프로필의 어떤 내용이 어떻게 겹치는지 구체적으로 짚고, 그것이 실제 관계에서 어떤 의미인지까지 설명한다.
  "취미가 비슷하다" 같은 뭉뚱그린 표현 대신 "둘 다 크로스핏을 주 3회 하는데, 운동 강도와 빈도가 맞아 함께 운동 루틴을 짜기 좋다"처럼 쓴다.
  **reasons 중 최소 1개는 teams.*.selfReported의 답변을 큰따옴표로 직접 인용해야 한다.** 어느 쪽 사람의 답변이든 상관없다.
  예시: 상대가 CX 팀에서 TMI로 "커피를 못마셔요.."라고 적었는데, 당신도 카페인을 안 하니 카페 고를 때 서로 눈치 볼 일이 없다.
  원문을 다듬지 말고 오타·말줄임표·이모지까지 적힌 그대로 인용한다. 인용이 하나도 없으면 실패다.
- concerns: 3~4개. 실제로 부딪힐 수 있는 지점을 솔직하게 쓰되, 어떻게 하면 완화되는지도 덧붙인다.
  기피 음식·생활 리듬·성향 차이를 우선 살핀다. 억지로 문제를 만들지는 말고, 정말 없으면 "차이가 크지 않다"는 관찰도 하나의 항목이 된다.
- conversationStarters: 4~6개. 그냥 주제만 던지지 말고, 실제로 건넬 만한 구체적인 질문이나 화제로 쓴다.
  "운동 얘기" 대신 "크로스핏 WOD 중에 제일 싫어하는 동작이 뭔지 물어보세요. 서로 고생담이 바로 나옵니다"처럼 쓴다.

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
        required: ['candidateId', 'score', 'headline', 'reasons', 'concerns', 'conversationStarters'],
        properties: {
          candidateId: { type: 'string' },
          score: { type: 'integer' },
          headline: { type: 'string' },
          reasons: { type: 'array', items: { type: 'string' } },
          concerns: { type: 'array', items: { type: 'string' } },
          conversationStarters: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

const SEARCH_PROMPT = `너는 홍대(홍익대 앞·연남동·상수동·망원 일대) 지역 조사원이다.
두 사람의 프로필을 보고, 하루 데이트에 쓸 실제 가게를 web_search로 조사한다.

반드시 웹 검색을 여러 번 사용해서 아래를 조사하라:
- 점심 식사할 식당 (두 사람의 food.likes 반영, food.cannot_eat에 걸리는 업종은 제외)
- 저녁 식사할 식당
- 카페 또는 디저트 (커피를 못 마시는 사람이 있으면 논커피 메뉴가 있는 곳)
- 두 사람의 interests에 맞는 활동 장소 (전시, 공방, 산책로, 서점 등)

각 후보마다 아래를 빠짐없이 적어라:
- 정확한 상호명
- 도로명 주소 전체 (예: "서울 마포구 와우산로 29길 12"). "홍대 일대" 같은 뭉뚱그린 표기는 금지다.
  검색으로 주소를 못 찾은 가게는 아예 후보에서 빼라.
- 대표 메뉴나 특징
- 영업시간, 예약 필요 여부

검색으로 확인되지 않은 가게는 적지 마라. 기억에 의존해 상호를 지어내는 것은 절대 금지다.
검색으로 확인한 사실만 쓰되, **항목당 최소 3곳씩, 전체 12곳 이상**의 후보를 확보하라.
한 번의 검색으로 부족하면 검색어를 바꿔 여러 번 검색하라. 후보가 적으면 코스를 짤 수 없다.`;

const COURSE_PROMPT = `너는 홍대 데이트 코스 플래너다.
두 사람의 프로필과, 이미 웹 검색으로 조사된 가게 목록을 받는다.
조사된 가게 중에서만 골라 하루 데이트 코스를 구성한다.

반드시 지킬 것:
- place와 address는 조사 결과에 있는 값을 **글자 그대로 복사**한다. 요약하거나 줄이지 마라.
  address는 조사 결과의 도로명 주소 전체를 옮긴다. "홍대 일대", "연남동 근처"처럼 뭉개면 안 된다.
- 조사 결과에 주소가 없는 가게는 코스에 넣지 마라.
- 조사 결과에 없는 정보는 쓰지 마라. 새로운 가게를 지어내지 마라.
- time은 "13:00", "19:30"처럼 24시간제 숫자로만 쓴다.
- 못 먹는 음식을 파는 곳은 넣지 않는다. 커피를 못 마시는 사람이 있으면 논커피가 되는 곳을 고른다.
- 생활 리듬을 고려해 시작 시간을 정한다. 저녁형 인간이면 오전 일찍 시작하지 마라.

구성:
- **반드시 4~6개 코스**로 구성한다. 3개 이하는 실패다. 조사된 가게가 많으니 충분히 활용하라.
- 이동 동선이 자연스럽게 이어지도록 순서를 짠다.
- why에는 이 가게를 왜 이 두 사람에게 골랐는지 프로필 근거를 들어 설명한다.
- tips는 2~4개. 조사 결과에 나온 영업시간·웨이팅·예약 정보를 우선 쓴다.
- 모든 문장은 한국어로 쓴다.
- 사람 이름 뒤에는 항상 "님"을 붙인다. 두 사람 모두 예외 없다.
  **띄어쓰기 없이 이름에 바로 붙인다.** "곽소윤님"이 맞고 "곽소윤 님"은 틀리다.
  title에도 같은 규칙을 적용한다.`;

const COURSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'stops', 'tips'],
  properties: {
    title: { type: 'string' },
    stops: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['time', 'place', 'address', 'activity', 'why'],
        properties: {
          time: { type: 'string' },
          /** 실제 상호명 */
          place: { type: 'string' },
          address: { type: 'string' },
          activity: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    tips: { type: 'array', items: { type: 'string' } },
  },
} as const;

/** 1위 상대와의 홍대 데이트 코스. 실패해도 매칭 자체는 살린다. */
export async function buildDateCourse(me: any, partner: any, onStage?: (s: Stage) => void) {
  try {
    const profiles = `[A]\n${JSON.stringify(trim(me))}\n\n[B]\n${JSON.stringify(trim(partner))}`;

    // 1단계 — 웹 검색으로 실제 가게를 조사한다.
    // json_schema를 걸면 모델이 검색을 건너뛰므로, 검색 단계는 자유 텍스트로 받는다.
    const search = await openai.responses.create({
      model: config.openai.model,
      instructions: SEARCH_PROMPT,
      input: profiles,
      tools: [{ type: 'web_search', search_context_size: 'medium' }],
      // 강제하지 않으면 프로필 JSON만 보고 검색을 건너뛴다.
      tool_choice: { type: 'web_search_preview' },
      max_output_tokens: 6000,
    });

    const searched = search.output_text;
    const searchCalled = search.output.some((o) => o.type === 'web_search_call');
    if (!searchCalled) console.warn('[match] 데이트 코스: 웹 검색이 호출되지 않음');

    // 2단계 — 조사 결과를 구조화된 코스로 정리한다.
    onStage?.('course_shaping');
    const shaped = await openai.responses.create({
      model: config.openai.model,
      instructions: COURSE_PROMPT,
      input: `${profiles}\n\n[웹 검색으로 조사한 가게 정보]\n${searched}`,
      text: {
        format: { type: 'json_schema', name: 'date_course', strict: true, schema: COURSE_SCHEMA },
      },
      max_output_tokens: 8000,
    });

    const raw = shaped.output_text;
    const course = raw ? (JSON.parse(raw) as DateCourse) : null;
    return {
      course: course ? fixHonorific(course, [me.name, partner.name]) : null,
      usage: {
        inputTokens: (search.usage?.input_tokens ?? 0) + (shaped.usage?.input_tokens ?? 0),
        outputTokens: (search.usage?.output_tokens ?? 0) + (shaped.usage?.output_tokens ?? 0),
      },
    };
  } catch (err) {
    console.warn('[match] 데이트 코스 생성 실패:', err);
    return { course: null, usage: { inputTokens: 0, outputTokens: 0 } };
  }
}

export async function runMatching(userId: string): Promise<MatchDoc> {
  if (isRunning(userId)) {
    throw new HttpError(409, 'already_running', '다른 분석이 진행 중입니다. 잠시만 기다려 주세요.');
  }

  const me = await students().findOne({ _id: userId });
  if (!me) throw new HttpError(404, 'no_profile', '프로필을 찾을 수 없습니다.');

  const myGender = (me as any).profile?.gender;
  const candidates = await students().find({ 'profile.gender': { $ne: myGender } }).toArray();
  if (candidates.length === 0) {
    throw new HttpError(500, 'no_candidates', '매칭 가능한 후보가 없습니다.');
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

  const isRefresh = (await matches().countDocuments({ userId }, { limit: 1 })) > 0;

  const nameById = new Map(candidates.map((c) => [c._id, c.name]));
  const userMessage = [
    `[나]\n${JSON.stringify(trim(me))}`,
    `[이성 후보 ${candidates.length}명 — ID: ${candidates.map((c) => c._id).join(', ')}]`,
    JSON.stringify(candidates.map(trim)),
    `위 ${candidates.length}명 전원에 대해 결과를 내라. results 배열의 길이는 정확히 ${candidates.length}이어야 한다.`,
  ].join('\n\n');

  startJob(userId, 'matching');
  try {
    let results: MatchResult[] = [];
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
          json_schema: { name: 'matching', strict: true, schema: SCHEMA },
        },
        // 후보 14명 × 늘어난 분량. 기본값(4096)이면 JSON이 잘려 파싱에 실패한다.
        max_completion_tokens: 16000,
      });

      usage = {
        inputTokens: usage.inputTokens + (completion.usage?.prompt_tokens ?? 0),
        outputTokens: usage.outputTokens + (completion.usage?.completion_tokens ?? 0),
      };

      const raw = completion.choices[0]?.message?.content;
      if (!raw) continue;

      let parsed: { results?: MatchResult[] };
      try {
        parsed = JSON.parse(raw);
      } catch {
        // 출력이 잘리면 JSON이 깨진다. 재시도에 맡긴다.
        console.warn(`[match] ${userId} JSON 파싱 실패 (finish=${completion.choices[0]?.finish_reason})`);
        continue;
      }

      results = (fixHonorific(parsed.results, [me.name, ...nameById.values()]) ?? [])
        .filter((r) => nameById.has(r.candidateId))
        .map((r) => ({
          ...r,
          name: nameById.get(r.candidateId)!,
          score: Math.max(0, Math.min(100, Math.round(r.score))),
        }))
        .sort((a, b) => b.score - a.score);

      if (results.length === candidates.length) break;
      console.warn(
        `[match] ${userId} 후보 누락: ${results.length}/${candidates.length}` +
          (attempt === 0 ? ' — 재시도' : ' — 누락 상태로 진행'),
      );
    }

    if (results.length === 0) {
      throw new HttpError(502, 'ai_invalid', 'AI 결과를 해석할 수 없습니다. 다시 시도해 주세요.');
    }

    // 데이트 코스는 여기서 만들지 않는다. 매칭 결과를 먼저 보여주고,
    // 코스는 generateDateCourse()로 따로 요청받아 채운다 (체감 대기시간 단축).
    const doc: MatchDoc = {
      _id: new ObjectId(),
      userId,
      generatedAt: new Date(),
      isRefresh,
      model: config.openai.model,
      results,
      dateCourse: null,
      usage,
    };

    await spend({
      userId,
      amount: config.match.cost,
      reason: isRefresh ? 'match_refresh' : 'match_initial',
      refId: doc._id,
    });
    await matches().insertOne(doc);

    return doc;
  } finally {
    endJob(userId);
  }
}

/**
 * 최신 매칭의 데이트 코스를 만들어 저장한다.
 * 이미 있으면 그대로 돌려주고, 추가 과금은 없다.
 */
export async function generateDateCourse(userId: string): Promise<MatchDoc> {
  const doc = await latestMatch(userId);
  if (!doc) throw new HttpError(404, 'no_match', '먼저 운명의 상대를 찾아주세요.');
  if (doc.dateCourse) return doc;

  if (isRunning(userId)) {
    throw new HttpError(409, 'already_running', '다른 분석이 진행 중입니다. 잠시만 기다려 주세요.');
  }

  const me = await students().findOne({ _id: userId });
  const partner = await students().findOne({ _id: doc.results[0]?.candidateId });
  if (!me || !partner) throw new HttpError(404, 'no_profile', '프로필을 찾을 수 없습니다.');

  startJob(userId, 'course_search');
  try {
    const { course, usage } = await buildDateCourse(me, partner, (st) => setStage(userId, st));
    if (!course) {
      throw new HttpError(502, 'course_failed', '데이트 코스를 만들지 못했습니다. 다시 시도해 주세요.');
    }

    await matches().updateOne(
      { _id: doc._id },
      {
        $set: { dateCourse: course },
        $inc: {
          'usage.inputTokens': usage.inputTokens,
          'usage.outputTokens': usage.outputTokens,
        },
      },
    );
    return { ...doc, dateCourse: course };
  } finally {
    endJob(userId);
  }
}

export function latestMatch(userId: string): Promise<MatchDoc | null> {
  return matches().findOne({ userId }, { sort: { generatedAt: -1 } });
}

export function matchHistory(userId: string) {
  return matches()
    .find({ userId }, { sort: { generatedAt: -1 }, limit: 20 })
    .toArray();
}
