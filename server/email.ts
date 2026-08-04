import nodemailer from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export type EmailDeliveryMode = "preview" | "webhook" | "smtp";

function mode(): EmailDeliveryMode {
  const configured = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (configured === "smtp") return "smtp";
  if (configured === "webhook") return "webhook";
  return process.env.NODE_ENV === "production" ? "smtp" : "preview";
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

export function emailDeliveryStatus() {
  const provider = mode();
  return {
    provider,
    configured: provider === "preview" || (provider === "webhook" ? Boolean(process.env.EMAIL_WEBHOOK_URL) : smtpConfigured()),
  };
}

let smtpTransporter: nodemailer.Transporter | undefined;

function getSmtpTransporter() {
  if (!smtpConfigured()) throw new Error("smtp_provider_not_configured");
  if (!smtpTransporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim(),
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: process.env.SMTP_USER?.trim()
        ? { user: process.env.SMTP_USER.trim(), pass: process.env.SMTP_PASSWORD ?? "" }
        : undefined,
    });
  }
  return smtpTransporter;
}

export async function deliverEmail(message: EmailMessage) {
  const provider = mode();
  if (provider === "preview") return { provider, delivered: false as const };
  if (provider === "smtp") {
    await getSmtpTransporter().sendMail({
      from: process.env.SMTP_FROM?.trim(),
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { provider, delivered: true as const };
  }
  const url = process.env.EMAIL_WEBHOOK_URL;
  if (!url) throw new Error("email_provider_not_configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.EMAIL_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify(message),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`email_provider_http_${response.status}`);
    return { provider, delivered: true as const };
  } finally {
    clearTimeout(timeout);
  }
}
