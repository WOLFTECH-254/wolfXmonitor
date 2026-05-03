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
    `🔴 <b>wolfXmonitor ALERT</b>`,
    ``,
    `<b>${monitorName}</b> is DOWN`,
    `${monitorUrl}`,
    error ? `\nError: ${error}` : "",
    ``,
    `The wolf is watching — you'll be notified when it recovers.`,
  ].join("\n").trim();
}

export function buildDownMessagePlain(monitorName: string, monitorUrl: string, error?: string | null): string {
  return [
    `wolfXmonitor ALERT`,
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
    `✅ <b>wolfXmonitor RECOVERY</b>`,
    ``,
    `<b>${monitorName}</b> is back ONLINE`,
    `${monitorUrl}`,
    responseTimeMs ? `\nResponse time: ${responseTimeMs}ms` : "",
    ``,
    `All clear. The wolf continues watching.`,
  ].join("\n").trim();
}

export function buildRecoveryMessagePlain(monitorName: string, monitorUrl: string, responseTimeMs?: number | null): string {
  return [
    `wolfXmonitor RECOVERY`,
    ``,
    `${monitorName} is back ONLINE`,
    monitorUrl,
    responseTimeMs ? `Response time: ${responseTimeMs}ms` : "",
    ``,
    `All clear. The wolf continues watching.`,
  ].filter(Boolean).join("\n");
}
