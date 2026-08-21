import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Brevo가 설정돼 있으면 HTTP API로, 아니면 SMTP로 보낸다.
 * Render 무료 플랜은 SMTP 포트(25·465·587)를 막기 때문에 배포 환경에서는 Brevo를 쓴다.
 */
export async function sendMail(input: SendMailInput): Promise<void> {
  if (config.mail.brevoApiKey) {
    await sendViaBrevo(config.mail.brevoApiKey, input);
    return;
  }
  await sendViaSmtp(input);
}

async function sendViaBrevo(apiKey: string, input: SendMailInput): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: config.mail.fromName, email: config.mail.fromAddress },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    // 응답 본문에 원인이 담긴다 (발신자 미인증, 키 오류, 일일 한도 초과 등).
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo ${res.status}: ${detail}`);
  }
}

let transporter: Transporter | null = null;

/** 네이버 SMTP. 587은 STARTTLS, 465는 암묵적 SSL이다. */
async function sendViaSmtp(input: SendMailInput): Promise<void> {
  const smtp = config.smtp;
  if (!smtp) throw new Error('메일 발송 설정이 없습니다. BREVO_API_KEY 또는 SMTP_*를 지정하세요.');

  if (!transporter) {
    const isImplicitTls = smtp.port === 465;
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: isImplicitTls,
      requireTLS: !isImplicitTls,
      auth: { user: smtp.user, pass: smtp.pass },
      // 막힌 포트로 나가면 기본값(2분)까지 매달린다. 빨리 실패하고 안내하는 편이 낫다.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  await transporter.sendMail({
    from: `"${config.mail.fromName}" <${config.mail.fromAddress}>`,
    ...input,
  });
}
