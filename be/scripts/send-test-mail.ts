// 인증 메일 템플릿 발송 테스트. 기본 수신자는 발신 계정 본인이다.
import { sendMail } from '../src/lib/mailer';
import { buildVerificationMail } from '../src/lib/mail-templates';
import { config } from '../src/config';

async function main() {
  const to = process.argv[2] ?? config.mail.fromAddress;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const mail = buildVerificationMail(code, 10);

  console.log(`수신자: ${to}`);
  console.log(`인증번호: ${code}`);
  const messageId = await sendMail({ to, ...mail });
  console.log(`발송 완료. messageId=${messageId}`);
}

main().catch((err) => {
  console.error('발송 실패:', err.message);
  if (err.code) console.error('code:', err.code, '| response:', err.response ?? '(없음)');
  process.exit(1);
});
