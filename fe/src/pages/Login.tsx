import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Chip, ErrorText, Field, Panel } from '../components/ui-kit';

export function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user } = await api.login(email, password);
      setUser(user);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="로그인">
      <form onSubmit={onSubmit}>
        <ErrorText>{error}</ErrorText>
        <Field
          label="학교 이메일"
          type="email"
          placeholder="6155@dxschool.co.kr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          label="비밀번호"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Chip type="submit" disabled={busy}>
          {busy ? '확인 중' : '로그인'}
        </Chip>
        <p className="mt-3 text-[11px] text-carbon">
          아직 계정이 없다면{' '}
          <Link to="/signup" className="font-bold text-chrome-indigo underline">
            회원가입
          </Link>
        </p>
      </form>
    </Panel>
  );
}
