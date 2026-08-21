import { config } from '../config';
import { HttpError } from './http-error';

/**
 * Supabase Auth를 인증코드 발송·검증에만 쓴다.
 * 계정과 세션은 그대로 우리 쪽(Mongo + express-session)이 관리하고,
 * Supabase는 "이 사람이 이 메일함을 갖고 있다"만 확인해 준다.
 *
 * Render는 SMTP 포트가 막혀 있지만 여기는 HTTPS(443)로만 나간다.
 * 실제 발송은 Supabase에 연결된 네이버 SMTP가 한다.
 */

async function call(path: string, body: unknown): Promise<Response> {
  const sb = config.supabase;
  if (!sb) throw new Error('SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY가 설정되지 않았습니다.');

  return fetch(`${sb.url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: sb.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
}

/** 6자리 코드를 메일로 보낸다. 템플릿이 {{ .Token }}이라 링크가 아닌 숫자가 나간다. */
export async function sendOtp(email: string): Promise<void> {
  const res = await call('otp', { email, create_user: true });
  if (res.ok) return;

  if (res.status === 429) {
    throw new HttpError(429, 'resend_cooldown', '잠시 후에 다시 요청할 수 있습니다.');
  }
  throw new Error(`Supabase otp ${res.status}: ${await res.text().catch(() => '')}`);
}

/**
 * 코드를 검증한다.
 * GoTrue는 발급 경위에 따라 type이 갈린다(신규는 signup, 기존 사용자는 magiclink).
 * email이 통합 타입이지만 버전에 따라 다르므로 순서대로 시도한다.
 */
const VERIFY_TYPES = ['email', 'signup', 'magiclink'] as const;

export async function verifyOtp(email: string, token: string): Promise<void> {
  let lastStatus = 0;
  for (const type of VERIFY_TYPES) {
    const res = await call('verify', { type, email, token });
    if (res.ok) return;
    lastStatus = res.status;
    // 코드 자체가 틀렸으면 타입을 바꿔도 소용없지만, 응답만으로는 구분되지 않아 끝까지 시도한다.
  }
  throw new HttpError(
    400,
    'invalid_code',
    lastStatus === 429
      ? '시도가 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
      : '인증번호가 일치하지 않거나 만료되었습니다.',
  );
}
