import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, type EditableField, type EditRequest } from '../lib/api';
import { Chip, ErrorText, Panel } from '../components/ui-kit';

/** 서버 값을 입력창에 넣을 문자열로 바꾼다. list는 쉼표로 합친다. */
const toInput = (f: EditableField) =>
  Array.isArray(f.value) ? f.value.join(', ') : (f.value ?? '');

export function EditProfile() {
  const navigate = useNavigate();
  const [fields, setFields] = useState<EditableField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<EditRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    api
      .editable()
      .then((r) => {
        setFields(r.fields);
        setPending(r.pending);
        setValues(Object.fromEntries(r.fields.map((f) => [f.path, toInput(f)])));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const changedCount = fields.filter((f) => values[f.path] !== toInput(f)).length;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // 바뀐 것만 보낸다.
      const changed = Object.fromEntries(
        fields.filter((f) => values[f.path] !== toInput(f)).map((f) => [f.path, values[f.path]]),
      );
      await api.submitEdit(changed);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '요청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Panel>
        <p className="legend text-chrome-indigo">불러오는 중…</p>
      </Panel>
    );
  }

  if (done) {
    return (
      <Panel title="수정 요청 완료">
        <p className="mb-3 text-[12px] text-carbon">
          어드민에게 수정 요청을 보냈습니다. 승인되면 프로필에 반영됩니다.
        </p>
        <Chip onClick={() => navigate('/my')}>마이페이지로</Chip>
      </Panel>
    );
  }

  if (pending) {
    return (
      <Panel title="검토 중인 요청이 있습니다">
        <p className="mb-3 text-[12px] text-carbon">
          {new Date(pending.requestedAt).toLocaleString('ko-KR')}에 보낸 요청이 아직 처리되지
          않았습니다. 어드민이 승인하거나 거절한 뒤에 다시 요청할 수 있습니다.
        </p>
        <ul className="mb-3 text-[12px] text-carbon">
          {pending.changes.map((c) => (
            <li key={c.path} className="inset mb-1 px-2 py-1.5">
              <span className="legend mr-2 text-chrome-indigo">{c.label}</span>
              <span className="text-muted-indigo line-through">{format(c.before)}</span>
              <span className="mx-1">→</span>
              <span className="font-bold">{format(c.after)}</span>
            </li>
          ))}
        </ul>
        <Link to="/my">
          <Chip>마이페이지로</Chip>
        </Link>
      </Panel>
    );
  }

  return (
    <Panel title="내 정보 수정">
      <p className="mb-3 text-[11px] text-chrome-indigo">
        수정한 내용은 바로 반영되지 않고 어드민 승인 후 적용됩니다. 여러 항목을 한 번에 보낼 수
        있습니다.
      </p>
      <ErrorText>{error}</ErrorText>

      <form onSubmit={onSubmit}>
        {fields.map((f) => (
          <label key={f.path} className="mb-3 block">
            <span className="legend mb-1 block text-carbon">
              {f.label}
              {f.type === 'list' && <span className="ml-1 text-muted-indigo">(쉼표로 구분)</span>}
              {values[f.path] !== toInput(f) && <span className="ml-1 text-brand-red">· 변경됨</span>}
            </span>
            {f.type === 'textarea' ? (
              <textarea
                rows={3}
                value={values[f.path] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.path]: e.target.value }))}
                className="inset w-full p-2 text-[12px] text-carbon"
              />
            ) : (
              <input
                value={values[f.path] ?? ''}
                placeholder={f.hint}
                onChange={(e) => setValues((v) => ({ ...v, [f.path]: e.target.value }))}
                className="inset min-h-11 w-full px-2 text-[12px] text-carbon"
              />
            )}
          </label>
        ))}

        <div className="flex items-center gap-3">
          <Chip type="submit" variant="signal" disabled={busy || changedCount === 0}>
            {busy ? '보내는 중' : `수정 요청 보내기${changedCount > 0 ? ` (${changedCount})` : ''}`}
          </Chip>
          <Link to="/my" className="text-[11px] text-chrome-indigo underline">
            취소
          </Link>
        </div>
      </form>
    </Panel>
  );
}

export function format(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(없음)';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(없음)';
  return String(value);
}
