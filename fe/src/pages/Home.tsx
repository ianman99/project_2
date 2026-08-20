import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  ApiError,
  type DateCourse,
  type MatchProgress,
  type MatchResult,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { Chip, ErrorText, Panel } from '../components/ui-kit';
import { Progress } from '../components/Progress';

const POLL_MS = 3000;

export function Home() {
  const { user, setUser } = useAuth();
  const [result, setResult] = useState<MatchResult | null>(null);
  const [progress, setProgress] = useState<MatchProgress | null>(null);
  const [cost, setCost] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 코스 자동 생성을 한 번만 시도하기 위한 표시
  const courseRequested = useRef(false);

  const refresh = useCallback(async () => {
    const r = await api.latestMatch();
    setResult(r.result);
    setProgress(r.progress);
    setCost(r.cost);
    return r;
  }, []);

  // 최초 로드 — 진행 중이던 작업이 있으면 그 상태로 복귀한다.
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, refresh]);

  // 진행 중이면 주기적으로 상태를 확인한다.
  useEffect(() => {
    if (!progress) return;
    const timer = setInterval(() => {
      void refresh()
        .then(async (r) => {
          // 매칭이 끝났는데 코스가 없으면 이어서 만든다.
          if (!r.progress && r.result && !r.result.dateCourse && !courseRequested.current) {
            courseRequested.current = true;
            void startCourse();
          }
          if (!r.progress) {
            const { user } = await api.me(); // 차감된 잔액 반영
            setUser(user);
          }
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [progress, refresh, setUser]);

  const startMatch = async () => {
    setError('');
    courseRequested.current = false;
    try {
      // 응답을 기다리지 않는다. 진행 상태는 폴링으로 따라간다.
      setProgress({ stage: 'matching', label: '매칭을 시작하는 중', percent: 0, elapsedMs: 0 });
      await api.runMatch();
      courseRequested.current = true;
      await refresh();
      const { user } = await api.me();
      setUser(user);
      void startCourse();
    } catch (err) {
      setProgress(null);
      setError(err instanceof ApiError ? err.message : '매칭에 실패했습니다.');
    }
  };

  const startCourse = async () => {
    setError('');
    try {
      setProgress({
        stage: 'course_search',
        label: '데이트 코스를 준비하는 중',
        percent: 0,
        elapsedMs: 0,
      });
      await api.generateDateCourse();
      await refresh();
    } catch (err) {
      setProgress(null);
      setError(err instanceof ApiError ? err.message : '데이트 코스를 만들지 못했습니다.');
    }
  };

  const busy = progress !== null;

  return (
    <>
      <div className="plate mb-4 bg-lavender p-8 text-center">
        <img src="/logo.png" alt="" className="mx-auto mb-3 h-20 w-20" />
        <h1 className="wordmark text-[44px] leading-none">사랑찾아 인생을찾아</h1>
        <p className="mt-3 text-[15px] font-bold text-carbon">
          DX SCHOOL 6기 1반, 나에게 가장 잘 맞는 사람은 누구일까
        </p>
      </div>

      {!user ? (
        <Panel title="시작하기">
          <p className="mb-3 text-[12px] text-carbon">
            6기 1반 24명 전용 서비스입니다. 학번 이메일로 가입한 뒤 이용할 수 있습니다.
          </p>
          <div className="flex gap-2">
            <Link to="/login">
              <Chip>로그인</Chip>
            </Link>
            <Link to="/signup">
              <Chip variant="signal">회원가입</Chip>
            </Link>
          </div>
        </Panel>
      ) : loading ? (
        <Panel>
          <p className="legend text-chrome-indigo">불러오는 중…</p>
        </Panel>
      ) : (
        <>
          {result && <MatchCard result={result} />}

          {result?.dateCourse ? (
            <DateCourseCard course={result.dateCourse} />
          ) : result && !busy ? (
            <Panel title="홍대 데이트 코스">
              <p className="mb-3 text-[12px] text-carbon">
                두 분에게 맞는 홍대 하루 코스를 만들어 드립니다. 추가 포인트는 들지 않습니다.
              </p>
              <Chip variant="signal" onClick={startCourse}>
                데이트 코스 만들기
              </Chip>
            </Panel>
          ) : null}

          <Panel title={busy ? 'AI 분석 중' : result ? '다시 찾기' : '운명의 상대'}>
            <ErrorText>{error}</ErrorText>

            {busy ? (
              <Progress progress={progress} />
            ) : (
              <>
                {!result && (
                  <p className="mb-3 text-[12px] text-carbon">
                    <strong>{user.name}</strong>님, AI가 프로필을 분석해 가장 잘 맞는 이성을
                    찾아드립니다.
                  </p>
                )}
                <div className="inset mb-3 p-3">
                  <p className="legend mb-1 text-chrome-indigo">비용</p>
                  <p className="text-[12px] text-carbon">
                    1회 {cost.toLocaleString()} P · 보유 {user.points.toLocaleString()} P
                  </p>
                </div>
                <Chip variant="signal" onClick={startMatch} disabled={user.points < cost}>
                  {result ? '운명의 상대 새로고침' : '운명의 상대 찾기'}
                </Chip>
                {user.points < cost && (
                  <p className="mt-2 text-[11px] text-brand-red">
                    포인트가 부족합니다. 마이페이지에서 충전을 요청하세요.
                  </p>
                )}
              </>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function MatchCard({ result }: { result: MatchResult }) {
  const { match } = result;
  return (
    <Panel title="당신의 운명의 상대">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-display text-[32px] leading-none text-carbon">{match.name}님</span>
        <span className="font-display text-[32px] leading-none text-brand-red">{match.score}%</span>
      </div>
      <p className="inset mb-3 p-3 text-[13px] font-bold text-carbon">{match.headline}</p>

      <Section title="이래서 잘 맞습니다" items={match.reasons} />
      <Section title="이런 점은 고려하세요" items={match.concerns} />
      <Section title="이런 얘기로 시작해보세요" items={match.conversationStarters} />

      <p className="mt-3 text-[10px] text-muted-indigo">
        {new Date(result.generatedAt).toLocaleString('ko-KR')} 분석
      </p>
    </Panel>
  );
}

function DateCourseCard({ course }: { course: DateCourse }) {
  return (
    <Panel title="홍대 데이트 코스">
      <p className="mb-3 font-display text-[18px] leading-tight text-carbon">{course.title}</p>

      <ol className="mb-3">
        {course.stops.map((stop, i) => (
          <li key={i} className="inset mb-2 p-3">
            <div className="mb-1 flex items-baseline gap-2">
              <span className="chip bg-signal px-2 py-0.5 legend text-carbon">{stop.time}</span>
              <span className="text-[13px] font-bold text-carbon">{stop.place}</span>
            </div>
            <p className="text-[11px] text-muted-indigo">{stop.address}</p>
            <p className="mt-1 text-[12px] text-carbon">{stop.activity}</p>
            <p className="mt-1 text-[11px] text-chrome-indigo">{stop.why}</p>
          </li>
        ))}
      </ol>

      {course.tips.length > 0 && (
        <>
          <p className="legend mb-1 text-chrome-indigo">알아두면 좋은 것</p>
          <ul className="text-[12px] text-carbon">
            {course.tips.map((tip, i) => (
              <li key={i} className="inset mb-1 px-2 py-1.5">
                {tip}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="legend mb-1 text-chrome-indigo">{title}</p>
      <ul className="text-[12px] text-carbon">
        {items.map((item, i) => (
          <li key={i} className="inset mb-1 px-2 py-1.5">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
