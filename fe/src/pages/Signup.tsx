import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Chip, ErrorText, Field, Panel } from '../components/ui-kit';

export function Signup() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '요청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.requestCode(email);
      setStep(2);
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { user } = await api.verifySignup(email, code, password);
      setUser(user);
      navigate('/');
    });
  };

  return (
    <Panel title={`회원가입 — ${step}/2 단계`}>
      <ErrorText>{error}</ErrorText>

      {step === 1 ? (
        <form onSubmit={sendCode}>
          <p className="mb-3 text-[11px] text-carbon">
            학번 이메일로만 가입할 수 있습니다. 인증번호를 보내드립니다.
          </p>
          <Field
            label="학교 이메일"
            type="email"
            placeholder="6155@dxschool.co.kr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Chip type="submit" variant="signal" disabled={busy}>
            {busy ? '발송 중' : '인증번호 받기'}
          </Chip>
        </form>
      ) : (
        <form onSubmit={verify}>
          <p className="mb-3 text-[11px] text-carbon">
            <strong>{email}</strong> 로 보낸 6자리 인증번호를 입력하세요. (10분 유효)
          </p>
          <Field
            label="인증번호"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <Field
            label="비밀번호 (8자 이상)"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Chip type="submit" variant="signal" disabled={busy}>
            {busy ? '확인 중' : '가입 완료'}
          </Chip>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="ml-3 text-[11px] text-chrome-indigo underline"
          >
            이메일 다시 입력
          </button>
        </form>
      )}
    </Panel>
  );
}
