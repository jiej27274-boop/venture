export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export type EmailDeliveryMode = "preview" | "webhook";

function mode(): EmailDeliveryMode {
  return process.env.EMAIL_PROVIDER === "webhook" ? "webhook" : "preview";
}

export function emailDeliveryStatus() {
  const provider = mode();
  return {
    provider,
    configured: provider === "preview" || Boolean(process.env.EMAIL_WEBHOOK_URL),
  };
}

export async function deliverEmail(message: EmailMessage) {
  const provider = mode();
  if (provider === "preview") return { provider, delivered: false as const };
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
