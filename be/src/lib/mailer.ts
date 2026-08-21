import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const from = () => `"${config.mail.fromName}" <${config.mail.fromAddress}>`;

/**
 * Resend가 설정돼 있으면 HTTP API로, 아니면 SMTP로 보낸다.
 * Render 무료 플랜은 SMTP 포트(25·465·587)를 막기 때문에 배포 환경에서는 Resend를 쓴다.
 */
export async function sendMail(input: SendMailInput): Promise<void> {
  if (config.mail.resendApiKey) {
    await sendViaResend(config.mail.resendApiKey, input);
    return;
  }
  await sendViaSmtp(input);
}

async function sendViaResend(apiKey: string, input: SendMailInput): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: from(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    // 응답 본문에 원인이 담긴다 (도메인 미인증, 키 오류 등).
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
}

let transporter: Transporter | null = null;

/** 네이버 SMTP. 587은 STARTTLS, 465는 암묵적 SSL이다. */
async function sendViaSmtp(input: SendMailInput): Promise<void> {
  const smtp = config.smtp;
  if (!smtp) throw new Error('메일 발송 설정이 없습니다. RESEND_API_KEY 또는 SMTP_*를 지정하세요.');

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

  await transporter.sendMail({ from: from(), ...input });
}
