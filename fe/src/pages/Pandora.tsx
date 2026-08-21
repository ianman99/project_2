import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type MatchProgress, type PandoraResult } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Chip, ErrorText, Panel } from '../components/ui-kit';
import { Progress } from '../components/Progress';

const POLL_MS = 3000;

export function Pandora() {
  const { user, setUser } = useAuth();
  const [result, setResult] = useState<PandoraResult | null>(null);
  const [progress, setProgress] = useState<MatchProgress | null>(null);
  const [cost, setCost] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const r = await api.pandora();
    setResult(r.result);
    setProgress(r.progress);
    setCost(r.cost);
    return r;
  }, []);

  // 최초 로드 — 열어두고 나갔던 상자가 있으면 그 상태로 복귀한다.
  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);

  // 진행 중이면 주기적으로 상태를 확인한다.
  useEffect(() => {
    if (!progress) return;
    const timer = setInterval(() => {
      void refresh()
        .then(async (r) => {
          if (!r.progress) {
            const { user } = await api.me(); // 차감된 잔액 반영
            setUser(user);
          }
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [progress, refresh, setUser]);

  const open = async () => {
    setError('');
    try {
      // 응답을 기다리지 않는다. 진행 상태는 폴링으로 따라간다.
      setProgress({ stage: 'pandora', label: '상자를 여는 중', percent: 0, elapsedMs: 0 });
      await api.openPandora();
      await refresh();
      const { user } = await api.me();
      setUser(user);
    } catch (err) {
      setProgress(null);
      setError(err instanceof ApiError ? err.message : '상자를 열지 못했습니다.');
    }
  };

  if (!user) return null;

  const busy = progress !== null;

  return (
    <>
      <div className="slab mb-4 p-6 text-center">
        <p className="font-display text-[40px] leading-none text-brand-red">판도라의 상자</p>
        <p className="mt-2 text-[12px] font-bold text-amber">
          열면 되돌릴 수 없습니다 — 나와 가장 안 맞는 사람이 나옵니다
        </p>
      </div>

      {loading ? (
        <Panel>
          <p className="legend text-chrome-indigo">불러오는 중…</p>
        </Panel>
      ) : (
        <>
          {result && <WorstCard result={result} />}

          <Panel title={busy ? '상자를 여는 중' : result ? '다시 열기' : '경고'}>
            <ErrorText>{error}</ErrorText>

            {busy ? (
              <Progress progress={progress} />
            ) : (
              <>
                {!result && (
                  <p className="mb-3 text-[12px] text-carbon">
                    <strong>{user.name}</strong>님, 이 상자에는 <strong>운명의 상대의 정반대</strong>가
                    들어 있습니다. 취향·생활 리듬·성향이 가장 심하게 부딪히는 사람을 AI가 찾아냅니다.
                    <br />
                    재미로 보는 결과입니다. 사람이 아니라 <strong>조합</strong>을 평가합니다.
                  </p>
                )}
                <div className="inset mb-3 p-3">
                  <p className="legend mb-1 text-chrome-indigo">비용</p>
                  <p className="text-[12px] text-carbon">
                    1회 {cost.toLocaleString()} P · 보유 {user.points.toLocaleString()} P
                  </p>
                </div>
                <Chip onClick={open} disabled={user.points < cost}>
                  {result ? '상자 다시 열기' : '상자 열기'}
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

function WorstCard({ result }: { result: PandoraResult }) {
  const { worst } = result;
  return (
    <Panel title="상자에서 나온 사람">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-display text-[32px] leading-none text-carbon">{worst.name}님</span>
        <span className="font-display text-[32px] leading-none text-brand-red">{worst.score}</span>
        <span className="legend text-chrome-indigo">재앙 지수</span>
      </div>
      <p className="inset mb-3 border-l-4 border-l-brand-red p-3 text-[13px] font-bold text-carbon">
        {worst.headline}
      </p>

      <Section title="이래서 안 맞습니다" items={worst.reasons} />

      <div className="mb-3">
        <p className="legend mb-1 text-chrome-indigo">이런 일이 벌어집니다</p>
        <p className="slab p-3 text-[12px] leading-relaxed text-platinum">{worst.disasterScene}</p>
      </div>

      <Section title="그래도 만난다면" items={worst.survivalTips} />

      <p className="mt-3 text-[10px] text-muted-indigo">
        {new Date(result.generatedAt).toLocaleString('ko-KR')} 분석 · 재미로 보는 결과입니다
      </p>
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
