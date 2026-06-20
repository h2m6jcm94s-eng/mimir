import { type Transporter, createTransport } from 'nodemailer';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transporter: Transporter | undefined;

export function getEmailTransporter(): Transporter | undefined {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return undefined;
  }

  transporter = createTransport({
    host,
    port,
    auth: { user, pass },
    secure: port === 465,
  });

  return transporter;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const transport = getEmailTransporter();
  if (!transport) {
    throw new Error('Email transport not configured (SMTP_HOST/PORT/USER/PASS missing)');
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!from) {
    throw new Error('SMTP_FROM or SMTP_USER must be set');
  }

  await transport.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export function resetEmailTransporter(): void {
  transporter = undefined;
}
