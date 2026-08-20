import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  EDIT_STATUS_LABEL,
  REASON_LABEL,
  type EditRequest,
  type MatchResult,
  type PointTransaction,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { Chip, Panel } from '../components/ui-kit';
import { ProfileTree } from '../components/ProfileTree';
import { format } from './EditProfile';

export function My() {
  const { user } = useAuth();
  const [points, setPoints] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [history, setHistory] = useState<MatchResult[]>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);

  useEffect(() => {
    api.points().then((r) => {
      setPoints(r.points);
      setTransactions(r.transactions);
    });
    api.matchHistory().then((r) => setHistory(r.items));
    api.fullProfile().then((r) => setProfile(r.profile));
    api.myEditRequests().then((r) => setEditRequests(r.items));
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
        <div className="flex gap-2">
          <Chip onClick={() => setShowProfile((v) => !v)}>
            {showProfile ? '접기' : '펼쳐 보기'}
          </Chip>
          <Link to="/my/edit">
            <Chip variant="signal">내 정보 수정</Chip>
          </Link>
        </div>
        {showProfile &&
          (profile ? (
            <div className="mt-3">
              <ProfileTree profile={profile} />
            </div>
          ) : (
            <p className="mt-3 legend text-chrome-indigo">불러오는 중…</p>
          ))}
      </Panel>

      {editRequests.length > 0 && (
        <Panel title="수정 요청 상태">
          {editRequests.map((req) => (
            <div key={req.id} className="inset mb-2 p-2">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`chip px-2 py-0.5 legend text-carbon ${
                    req.status === 'pending'
                      ? 'bg-amber'
                      : req.status === 'approved'
                        ? 'bg-signal'
                        : 'bg-platinum'
                  }`}
                >
                  {EDIT_STATUS_LABEL[req.status]}
                </span>
                <span className="text-[10px] text-muted-indigo">
                  {new Date(req.requestedAt).toLocaleString('ko-KR')} 요청
                  {req.resolvedAt &&
                    ` · ${new Date(req.resolvedAt).toLocaleString('ko-KR')} 처리`}
                </span>
              </div>
              <ul className="text-[12px] text-carbon">
                {req.changes.map((c) => (
                  <li key={c.path} className="border-l-2 border-chrome-indigo pl-2">
                    <span className="legend mr-2 text-chrome-indigo">{c.label}</span>
                    <span className="text-muted-indigo line-through">{format(c.before)}</span>
                    <span className="mx-1">→</span>
                    <span className="font-bold">{format(c.after)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Panel>
      )}

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
