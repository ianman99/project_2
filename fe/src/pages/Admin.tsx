import { useEffect, useState } from 'react';
import { api, ApiError, type EditRequest } from '../lib/api';
import { Chip, ErrorText, Panel } from '../components/ui-kit';
import { format } from './EditProfile';

export function Admin() {
  const [items, setItems] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    api
      .editRequests()
      .then((r) => setItems(r.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.'))
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const resolve = async (id: string, action: 'approve' | 'reject') => {
    setError('');
    setBusyId(id);
    try {
      await (action === 'approve' ? api.approveEdit(id) : api.rejectEdit(id));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '처리에 실패했습니다.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <Panel title="프로필 수정 요청">
        <ErrorText>{error}</ErrorText>
        {loading ? (
          <p className="legend text-chrome-indigo">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="text-[11px] text-chrome-indigo">대기 중인 요청이 없습니다.</p>
        ) : (
          items.map((req) => (
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
                  onClick={() => resolve(req.id, 'approve')}
                >
                  승인
                </Chip>
                <Chip disabled={busyId === req.id} onClick={() => resolve(req.id, 'reject')}>
                  거절
                </Chip>
              </div>
            </div>
          ))
        )}
      </Panel>

      <Panel title="포인트 지급">
        <p className="text-[11px] text-chrome-indigo">지급 기능은 PRD 7단계에서 연결됩니다.</p>
      </Panel>
    </>
  );
}
