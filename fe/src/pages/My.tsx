import { useEffect, useState } from 'react';
import { api, REASON_LABEL, type MatchResult, type PointTransaction } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Chip, Panel } from '../components/ui-kit';
import { ProfileTree } from '../components/ProfileTree';

export function My() {
  const { user } = useAuth();
  const [points, setPoints] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [history, setHistory] = useState<MatchResult[]>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    api.points().then((r) => {
      setPoints(r.points);
      setTransactions(r.transactions);
    });
    api.matchHistory().then((r) => setHistory(r.items));
    api.fullProfile().then((r) => setProfile(r.profile));
  }, []);

  if (!user) return null;

  const rows = [
    ['학번', user.studentNo],
    ['이름', user.name],
    ['이메일', user.email],
    ['권한', user.role === 'admin' ? '어드민' : '일반'],
  ] as const;

  return (
    <>
      <Panel title="내 정보">
        <dl className="text-[12px] text-carbon">
          {rows.map(([label, value]) => (
            <div key={label} className="inset mb-1 flex justify-between px-2 py-1.5">
              <dt className="legend text-chrome-indigo">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title="포인트">
        <p className="mb-3 font-display text-[32px] leading-none text-carbon">
          {(points ?? user.points).toLocaleString()} <span className="text-[14px]">P</span>
        </p>
        <Chip disabled title="7단계에서 연결됩니다">
          충전 요청
        </Chip>
      </Panel>

      <Panel title="내 데이터 전체">
        <p className="mb-2 text-[11px] text-chrome-indigo">
          서비스가 보관 중인 내 프로필 원본입니다. 전화번호를 포함한 모든 항목이며, 본인만 볼 수 있습니다.
        </p>
        <Chip onClick={() => setShowProfile((v) => !v)}>
          {showProfile ? '접기' : '펼쳐 보기'}
        </Chip>
        {showProfile &&
          (profile ? (
            <div className="mt-3">
              <ProfileTree profile={profile} />
            </div>
          ) : (
            <p className="mt-3 legend text-chrome-indigo">불러오는 중…</p>
          ))}
      </Panel>

      <Panel title="매칭 이력">
        {history.length === 0 ? (
          <p className="text-[11px] text-chrome-indigo">아직 매칭 기록이 없습니다.</p>
        ) : (
          <ul className="text-[12px] text-carbon">
            {history.map((h) => (
              <li key={h.id} className="inset mb-1 flex items-center gap-2 px-2 py-1.5">
                <span className="legend w-32 shrink-0 text-chrome-indigo">
                  {new Date(h.generatedAt).toLocaleDateString('ko-KR')}
                  {h.isRefresh && ' · 새로고침'}
                </span>
                <span className="flex-1 font-bold">{h.match.name}</span>
                <span className="font-bold text-brand-red">{h.match.score}%</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="사용 내역">
        {transactions.length === 0 ? (
          <p className="text-[11px] text-chrome-indigo">내역이 없습니다.</p>
        ) : (
          <ul className="text-[12px] text-carbon">
            {transactions.map((t) => (
              <li key={t.id} className="inset mb-1 flex items-center gap-2 px-2 py-1.5">
                <span className="legend w-24 shrink-0 text-chrome-indigo">
                  {new Date(t.createdAt).toLocaleDateString('ko-KR')}
                </span>
                <span className="flex-1">{t.memo ?? REASON_LABEL[t.reason]}</span>
                <span className={`font-bold ${t.delta > 0 ? 'text-chrome-indigo' : 'text-brand-red'}`}>
                  {t.delta > 0 ? '+' : ''}
                  {t.delta.toLocaleString()} P
                </span>
                <span className="w-20 text-right text-[10px] text-muted-indigo">
                  잔액 {t.balanceAfter.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
