// SMTP 접속과 인증만 확인한다. 메일은 보내지 않는다.
import { verifySmtpConnection } from '../src/lib/mailer';
import { config } from '../src/config';

async function main() {
  console.log(`접속 대상: ${config.smtp.host}:${config.smtp.port} (user=${config.smtp.user})`);
  await verifySmtpConnection();
  console.log('SMTP 접속 및 인증 성공');
}

main().catch((err) => {
  console.error('SMTP 실패:', err.message);
  if (err.code) console.error('code:', err.code, '| response:', err.response ?? '(없음)');
  process.exit(1);
});
