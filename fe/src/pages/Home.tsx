import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type Couple } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Chip, ErrorText, Panel } from '../components/ui-kit';

export function Home() {
  const { user } = useAuth();
  const [couples, setCouples] = useState<Couple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { couples } = await api.matchBoard();
      setCouples(couples);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void load().finally(() => setLoading(false));
  }, [user, load]);

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
      ) : (
        <Panel title={`성사된 커플 (${couples.length})`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Chip onClick={() => void load()}>새로고침</Chip>
            <Link to="/match">
              <Chip variant="signal">운명의 상대 찾기</Chip>
            </Link>
          </div>

          <ErrorText>{error}</ErrorText>

          <p className="mb-3 text-[11px] text-chrome-indigo">
            두 사람이 <strong>서로를 1위로 꼽았을 때만</strong> 성사로 봅니다. 한쪽만 꼽은 경우는
            공개되지 않습니다.
          </p>

          {loading ? (
            <p className="legend text-chrome-indigo">불러오는 중…</p>
          ) : couples.length === 0 ? (
            <div className="inset p-4 text-center">
              <p className="text-[12px] text-carbon">아직 성사된 커플이 없습니다.</p>
              <p className="mt-1 text-[11px] text-chrome-indigo">
                첫 번째 커플이 되어보세요.
              </p>
            </div>
          ) : (
            <ul>
              {couples.map((c) => (
                <li key={`${c.a.studentNo}-${c.b.studentNo}`} className="inset mb-2 p-3 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-display text-[20px] leading-none text-carbon">
                      {c.a.name}님
                    </span>
                    <span className="text-[22px] leading-none text-brand-red">♥</span>
                    <span className="font-display text-[20px] leading-none text-carbon">
                      {c.b.name}님
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-indigo">
                    서로 {c.a.score}% · {c.b.score}% ·{' '}
                    {new Date(c.matchedAt).toLocaleDateString('ko-KR')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </>
  );
}
