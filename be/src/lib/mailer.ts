import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';

let transporter: Transporter | null = null;

/**
 * 네이버 SMTP 트랜스포터. 587은 STARTTLS, 465는 암묵적 SSL이다.
 */
export function getTransporter(): Transporter {
  if (!transporter) {
    const isImplicitTls = config.smtp.port === 465;
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: isImplicitTls,
      requireTLS: !isImplicitTls,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

/** SMTP 접속과 인증만 확인한다. 메일은 보내지 않는다. */
export async function verifySmtpConnection(): Promise<void> {
  await getTransporter().verify();
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(input: SendMailInput): Promise<string> {
  const info = await getTransporter().sendMail({
    from: `"${config.mail.fromName}" <${config.mail.fromAddress}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  return info.messageId;
}
