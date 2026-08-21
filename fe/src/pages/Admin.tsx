import { useEffect, useState } from 'react';
import {
  api,
  ApiError,
  type Balance,
  type EditRequest,
  type PointRequest,
  type SignupCode,
} from '../lib/api';
import { Chip, ErrorText, Panel } from '../components/ui-kit';
import { format } from './EditProfile';

export function Admin() {
  const [edits, setEdits] = useState<EditRequest[]>([]);
  const [points, setPoints] = useState<PointRequest[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [codes, setCodes] = useState<SignupCode[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [e, p, b, c] = await Promise.all([
        api.editRequests(),
        api.pointRequests(),
        api.balances(),
        api.signupCodes(),
      ]);
      setEdits(e.items);
      setPoints(p.items);
      setBalances(b.items);
      setCodes(c.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
    }
  };

  // 인증코드는 10분이면 만료되고 학생은 지금 기다리고 있다. 주기적으로 다시 읽는다.
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, []);

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setError('');
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '처리에 실패했습니다.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <ErrorText>{error}</ErrorText>

      <Panel title={`가입 인증코드 (${codes.length})`}>
        <p className="mb-2 text-[11px] text-chrome-indigo">
          가입을 요청한 학생에게 아래 코드를 직접 전달하세요. 10분 뒤 만료됩니다.
        </p>
        {codes.length === 0 ? (
          <p className="text-[11px] text-chrome-indigo">대기 중인 요청이 없습니다.</p>
        ) : (
          codes.map((c) => (
            <div key={c.studentNo + c.expiresAt} className="inset mb-2 flex items-center gap-3 p-3">
              <span className="w-28 shrink-0 text-[12px] font-bold text-carbon">
                {c.studentNo} {c.name}
              </span>
              <span className="font-display text-[26px] leading-none tracking-[3px] text-brand-red">
                {c.code ?? '—'}
              </span>
              <span className="ml-auto legend text-chrome-indigo">{remaining(c.expiresAt)}</span>
            </div>
          ))
        )}
      </Panel>

      <Panel title={`충전 요청 (${points.length})`}>
        {points.length === 0 ? (
          <p className="text-[11px] text-chrome-indigo">대기 중인 요청이 없습니다.</p>
        ) : (
          points.map((req) => (
            <div key={req.id} className="inset mb-3 p-3">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-[13px] font-bold text-carbon">
                  {req.userName} ({req.userId})
                </span>
                <span className="text-[10px] text-muted-indigo">
                  {new Date(req.requestedAt).toLocaleString('ko-KR')}
                </span>
              </div>
              <p className="mb-2 border-l-2 border-chrome-indigo pl-2 text-[12px] text-carbon">
                {req.message}
              </p>
              <div className="flex items-center gap-2">
                <input
                  inputMode="numeric"
                  placeholder="지급 금액"
                  value={amounts[req.id] ?? ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [req.id]: e.target.value }))}
                  className="inset min-h-11 w-32 px-2 text-[12px] text-carbon"
                />
                <Chip
                  variant="signal"
                  disabled={busyId === req.id || !Number(amounts[req.id])}
                  onClick={() => run(req.id, () => api.approvePoints(req.id, Number(amounts[req.id])))}
                >
                  지급
                </Chip>
                <Chip
                  disabled={busyId === req.id}
                  onClick={() => run(req.id, () => api.rejectPoints(req.id))}
                >
                  거절
                </Chip>
              </div>
            </div>
          ))
        )}
      </Panel>

      <Panel title={`프로필 수정 요청 (${edits.length})`}>
        {edits.length === 0 ? (
          <p className="text-[11px] text-chrome-indigo">대기 중인 요청이 없습니다.</p>
        ) : (
          edits.map((req) => (
            <div key={req.id} className="inset mb-3 p-3">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-[13px] font-bold text-carbon">
                  {req.userName} ({req.userId})
                </span>
                <span className="text-[10px] text-muted-indigo">
                  {new Date(req.requestedAt).toLocaleString('ko-KR')}
                </span>
              </div>
              <ul className="mb-3 text-[12px] text-carbon">
                {req.changes.map((c) => (
                  <li key={c.path} className="mb-1 border-l-2 border-chrome-indigo pl-2">
                    <span className="legend mr-2 text-chrome-indigo">{c.label}</span>
                    <span className="text-muted-indigo line-through">{format(c.before)}</span>
                    <span className="mx-1">→</span>
                    <span className="font-bold">{format(c.after)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Chip
                  variant="signal"
                  disabled={busyId === req.id}
                  onClick={() => run(req.id, () => api.approveEdit(req.id))}
                >
                  승인
                </Chip>
                <Chip
                  disabled={busyId === req.id}
                  onClick={() => run(req.id, () => api.rejectEdit(req.id))}
                >
                  거절
                </Chip>
              </div>
            </div>
          ))
        )}
      </Panel>

      <DirectGrant balances={balances} onDone={load} />

      <Panel title="전체 포인트 잔액">
        <ul className="text-[12px] text-carbon">
          {balances.map((b) => (
            <li key={b.userId} className="inset mb-1 flex items-center gap-2 px-2 py-1.5">
              <span className="legend w-16 shrink-0 text-chrome-indigo">{b.userId}</span>
              <span className="flex-1">
                {b.name}
                {b.role === 'admin' && <span className="ml-1 text-[10px] text-signal">어드민</span>}
              </span>
              <span className="font-bold">{b.points.toLocaleString()} P</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function DirectGrant({ balances, onDone }: { balances: Balance[]; onDone: () => Promise<void> }) {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const submit = async () => {
    setError('');
    setDone('');
    setBusy(true);
    try {
      const r = await api.grantPoints(userId, Number(amount), memo || '어드민 직접 지급');
      setDone(`${userId} 잔액 ${r.balance.toLocaleString()} P`);
      setAmount('');
      setMemo('');
      await onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '지급에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="직접 지급">
      <ErrorText>{error}</ErrorText>
      {done && <p className="mb-2 text-[11px] text-chrome-indigo">지급 완료 — {done}</p>}

      <div className="mb-2 flex flex-wrap gap-2">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="inset min-h-11 px-2 text-[12px] text-carbon"
        >
          <option value="">대상 선택</option>
          {balances.map((b) => (
            <option key={b.userId} value={b.userId}>
              {b.userId} {b.name}
            </option>
          ))}
        </select>
        <input
          inputMode="numeric"
          placeholder="금액"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="inset min-h-11 w-28 px-2 text-[12px] text-carbon"
        />
        <input
          placeholder="사유 (선택)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="inset min-h-11 flex-1 px-2 text-[12px] text-carbon"
        />
      </div>
      <Chip variant="signal" onClick={submit} disabled={busy || !userId || !Number(amount)}>
        {busy ? '지급 중' : '지급'}
      </Chip>
      <p className="mt-2 text-[10px] text-muted-indigo">
        지급 상한은 없습니다. 금액을 확인한 뒤 누르세요.
      </p>
    </Panel>
  );
}

/** 만료까지 남은 시간. 이미 지났으면 목록에서 사라지므로 음수는 나오지 않는다. */
function remaining(expiresAt: string): string {
  const seconds = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return `${Math.floor(seconds / 60)}분 ${String(seconds % 60).padStart(2, '0')}초 남음`;
}
