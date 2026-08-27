import axios from "axios";
import { logger } from "./logger";
import { db, settingsTable } from "@workspace/db";

interface ChatConfig {
  telegramBotToken?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioWhatsappFrom?: string;
}

async function getChatConfig(): Promise<ChatConfig> {
  try {
    const rows = await db.select().from(settingsTable);
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      telegramBotToken: map.get("telegram_bot_token") ?? process.env.TELEGRAM_BOT_TOKEN,
      twilioAccountSid: map.get("twilio_account_sid") ?? process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: map.get("twilio_auth_token") ?? process.env.TWILIO_AUTH_TOKEN,
      twilioWhatsappFrom: map.get("twilio_whatsapp_from") ?? process.env.TWILIO_WHATSAPP_FROM,
    };
  } catch {
    return {};
  }
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const config = await getChatConfig();
  if (!config.telegramBotToken) {
    logger.warn("Telegram bot token not configured — skipping Telegram notification");
    return;
  }
  try {
    await axios.post(
      `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
      { chat_id: chatId, text, parse_mode: "HTML" }
    );
    logger.info({ chatId }, "Telegram message sent");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, chatId }, "Failed to send Telegram message");
  }
}

export async function sendWhatsAppMessage(toPhone: string, body: string): Promise<void> {
  const config = await getChatConfig();
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioWhatsappFrom) {
    logger.warn("Twilio credentials not configured — skipping WhatsApp notification");
    return;
  }
  const from = config.twilioWhatsappFrom.startsWith("whatsapp:")
    ? config.twilioWhatsappFrom
    : `whatsapp:${config.twilioWhatsappFrom}`;
  const to = toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`;
  try {
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`,
      new URLSearchParams({ From: from, To: to, Body: body }).toString(),
      {
        auth: { username: config.twilioAccountSid, password: config.twilioAuthToken },
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }
    );
    logger.info({ to }, "WhatsApp message sent");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, to }, "Failed to send WhatsApp message");
  }
}

export function buildDownMessage(monitorName: string, monitorUrl: string, error?: string | null): string {
  return [
    `🔴 <b>GuardiX ALERT</b>`,
    ``,
    `<b>${monitorName}</b> is DOWN`,
    `${monitorUrl}`,
    error ? `\nError: ${error}` : "",
    ``,
    `GuardiX is watching — you'll be notified when it recovers.`,
  ].join("\n").trim();
}

export function buildDownMessagePlain(monitorName: string, monitorUrl: string, error?: string | null): string {
  return [
    `GuardiX ALERT`,
    ``,
    `${monitorName} is DOWN`,
    monitorUrl,
    error ? `Error: ${error}` : "",
    ``,
    `You'll be notified when it recovers.`,
  ].filter(Boolean).join("\n");
}

export function buildRecoveryMessage(monitorName: string, monitorUrl: string, responseTimeMs?: number | null): string {
  return [
    `✅ <b>GuardiX RECOVERY</b>`,
    ``,
    `<b>${monitorName}</b> is back ONLINE`,
    `${monitorUrl}`,
    responseTimeMs ? `\nResponse time: ${responseTimeMs}ms` : "",
    ``,
    `All clear. GuardiX is still watching.`,
  ].join("\n").trim();
}

export function buildRecoveryMessagePlain(monitorName: string, monitorUrl: string, responseTimeMs?: number | null): string {
  return [
    `GuardiX RECOVERY`,
    ``,
    `${monitorName} is back ONLINE`,
    monitorUrl,
    responseTimeMs ? `Response time: ${responseTimeMs}ms` : "",
    ``,
    `All clear. GuardiX is still watching.`,
  ].filter(Boolean).join("\n");
}

export async function sendDiscordAlert(
  webhookUrl: string,
  type: "down" | "recovery" | "test",
  monitorName: string,
  monitorUrl: string,
  extra?: { error?: string | null; statusCode?: number | null; responseTimeMs?: number | null }
): Promise<void> {
  const isDown = type === "down";
  const isTest = type === "test";

  const color = isTest ? 0x22c55e : isDown ? 0xe53e3e : 0x22c55e;
  const emoji = isTest ? "🧪" : isDown ? "🔴" : "✅";
  const title = isTest
    ? "GuardiX — Test Alert"
    : isDown
    ? "GuardiX — Site Down"
    : "GuardiX — Site Recovered";

  const descriptionLines: string[] = [];
  if (isTest) {
    descriptionLines.push(`**${monitorName}** — Discord is connected!`);
    descriptionLines.push(`GuardiX alerts are now active on this channel.`);
  } else if (isDown) {
    descriptionLines.push(`**${monitorName}** is **DOWN**`);
    descriptionLines.push(`GuardiX is watching — you'll be notified when it recovers.`);
  } else {
    descriptionLines.push(`**${monitorName}** is back **ONLINE**`);
    descriptionLines.push(`All clear. GuardiX is still watching.`);
  }

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: "🌐 URL", value: monitorUrl, inline: false },
  ];

  if (isDown) {
    if (extra?.statusCode) {
      fields.push({ name: "⚠️ HTTP Status", value: `\`${extra.statusCode}\` — ${httpStatusLabel(extra.statusCode)}`, inline: true });
    }
    if (extra?.error) {
      fields.push({ name: "❌ Reason", value: extra.error, inline: false });
    }
  }

  if (!isDown && !isTest && extra?.responseTimeMs) {
    fields.push({ name: "⚡ Response Time", value: `\`${extra.responseTimeMs}ms\``, inline: true });
  }

  fields.push({ name: "🕐 Detected", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true });

  const payload = {
    embeds: [
      {
        title: `${emoji} ${title}`,
        description: descriptionLines.join("\n"),
        color,
        fields,
        footer: { text: "GuardiX · monitor.xwolf.space" },
      },
    ],
  };

  try {
    await axios.post(webhookUrl, payload, {
      headers: { "content-type": "application/json" },
    });
    logger.info({ webhookUrl: webhookUrl.slice(0, 40) }, "Discord alert sent");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "Failed to send Discord alert");
  }
}

function httpStatusLabel(code: number): string {
  const labels: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    408: "Request Timeout",
    429: "Too Many Requests",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    505: "HTTP Version Not Supported",
  };
  return labels[code] ?? (code >= 500 ? "Server Error" : code >= 400 ? "Client Error" : code >= 300 ? "Redirect" : "Unknown");
}
