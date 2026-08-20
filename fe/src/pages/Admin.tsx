import { useEffect, useState } from 'react';
import {
  api,
  ApiError,
  type Balance,
  type EditRequest,
  type PointRequest,
} from '../lib/api';
import { Chip, ErrorText, Panel } from '../components/ui-kit';
import { format } from './EditProfile';

export function Admin() {
  const [edits, setEdits] = useState<EditRequest[]>([]);
  const [points, setPoints] = useState<PointRequest[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [e, p, b] = await Promise.all([
        api.editRequests(),
        api.pointRequests(),
        api.balances(),
      ]);
      setEdits(e.items);
      setPoints(p.items);
      setBalances(b.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    void load();
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
