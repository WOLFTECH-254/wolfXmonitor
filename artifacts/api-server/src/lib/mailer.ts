import axios from "axios";
import { logger } from "./logger";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export interface EmailConfig {
  apiKey: string;
  senderEmail: string;
  senderName: string;
}

export async function getEmailConfig(): Promise<EmailConfig | null> {
  try {
    const rows = await db.select().from(settingsTable);
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const apiKey =
      map.get("brevo_api_key") ?? process.env.BREVO_API_KEY ?? "";
    const senderEmail =
      map.get("brevo_sender_email") ??
      process.env.BREVO_SENDER_EMAIL ??
      "alerts@xwolf.space";
    const senderName =
      map.get("brevo_sender_name") ??
      process.env.BREVO_SENDER_NAME ??
      "wolfXmonitor";

    if (!apiKey) return null;
    return { apiKey, senderEmail, senderName };
  } catch {
    const apiKey = process.env.BREVO_API_KEY ?? "";
    if (!apiKey) return null;
    return {
      apiKey,
      senderEmail: process.env.BREVO_SENDER_EMAIL ?? "alerts@xwolf.space",
      senderName: process.env.BREVO_SENDER_NAME ?? "wolfXmonitor",
    };
  }
}

async function sendEmail(
  config: EmailConfig,
  payload: object
): Promise<void> {
  await axios.post(BREVO_API_URL, payload, {
    headers: {
      "api-key": config.apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
  });
}

const BRAND = `<div style="font-family:'Courier New',monospace;max-width:540px;margin:0 auto;background:#080e0a;color:#d1ffd6;padding:32px;border-radius:8px;">`;
const BRAND_HEADER = `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
    <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:1px;">wolf<span style="color:#22c55e">X</span>monitor</span>
  </div>
  <div style="font-size:10px;color:#4b7a55;letter-spacing:3px;text-transform:uppercase;margin-bottom:28px;border-bottom:1px solid #1a3a22;padding-bottom:16px;">Uptime Monitor</div>
`;
const BRAND_FOOTER = `
  <div style="margin-top:28px;padding-top:16px;border-top:1px solid #1a3a22;font-size:10px;color:#4b5563;text-align:center;letter-spacing:1px;">
    wolfXmonitor is watching. 24/7. Every minute.
  </div>
</div>`;

export async function sendSignupWelcomeEmail(opts: {
  toEmail: string;
  toName: string;
}): Promise<void> {
  const { toEmail, toName } = opts;
  const config = await getEmailConfig();
  if (!config) return;

  const html = `${BRAND}${BRAND_HEADER}
    <div style="background:#0a1a0e;border:1px solid #22c55e55;border-radius:6px;padding:20px;margin-bottom:20px;">
      <div style="font-size:10px;color:#22c55e;text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;">Welcome aboard</div>
      <div style="font-size:22px;font-weight:700;color:#ffffff;margin-bottom:8px;">Hey ${toName} 👋</div>
      <div style="font-size:13px;color:#d1ffd6;line-height:1.7;">
        Your wolfXmonitor account is ready. The wolf is now on guard — add your first monitor and we'll watch it every minute, 24/7.
      </div>
    </div>
    <div style="font-size:12px;color:#6b7280;line-height:1.8;">
      <div style="margin-bottom:6px;"><span style="color:#22c55e;">✓</span> Real-time uptime monitoring</div>
      <div style="margin-bottom:6px;"><span style="color:#22c55e;">✓</span> Instant email alerts when things go wrong</div>
      <div style="margin-bottom:6px;"><span style="color:#22c55e;">✓</span> Response time tracking & history</div>
      <div style="margin-bottom:16px;"><span style="color:#22c55e;">✓</span> Free plan — no credit card needed</div>
      <a href="https://monitor.xwolf.space/dashboard" style="display:inline-block;background:#22c55e;color:#000;font-weight:700;font-size:12px;padding:10px 24px;border-radius:4px;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">Go to Dashboard →</a>
    </div>
  ${BRAND_FOOTER}`;

  try {
    await sendEmail(config, {
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: toEmail, name: toName }],
      subject: `Welcome to wolfXmonitor, ${toName}!`,
      htmlContent: html,
    });
    logger.info({ toEmail }, "Signup welcome email sent");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, toEmail }, "Failed to send signup welcome email");
  }
}

export async function sendWelcomeAlert(opts: {
  toEmail: string;
  toName: string;
  monitorName: string;
  monitorUrl: string;
}): Promise<void> {
  const { toEmail, toName, monitorName, monitorUrl } = opts;
  const config = await getEmailConfig();
  if (!config) {
    logger.warn("Brevo API key not configured — skipping welcome email");
    return;
  }

  const html = `${BRAND}${BRAND_HEADER}
    <div style="background:#0a1a0e;border:1px solid #22c55e55;border-radius:6px;padding:20px;margin-bottom:20px;">
      <div style="font-size:10px;color:#22c55e;text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;">✓ Now Monitoring</div>
      <div style="font-size:24px;font-weight:700;color:#ffffff;margin-bottom:6px;">${monitorName}</div>
      <a href="${monitorUrl}" style="font-size:12px;color:#22c55e;text-decoration:none;">${monitorUrl}</a>
    </div>
    <div style="font-size:12px;color:#6b7280;line-height:1.7;">
      Hey ${toName}, wolfXmonitor is now watching <strong style="color:#d1ffd6;">${monitorName}</strong>. You'll be notified immediately if it goes down.
    </div>
  ${BRAND_FOOTER}`;

  try {
    await sendEmail(config, {
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: toEmail, name: toName }],
      subject: `Now watching: ${monitorName}`,
      htmlContent: html,
    });
    logger.info({ toEmail, monitorName }, "Welcome alert email sent");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, toEmail, monitorName }, "Failed to send welcome alert email");
  }
}

export async function sendDownAlert(opts: {
  toEmail: string;
  toName: string;
  monitorName: string;
  monitorUrl: string;
  error?: string | null;
}): Promise<void> {
  const { toEmail, toName, monitorName, monitorUrl, error } = opts;
  const config = await getEmailConfig();
  if (!config) {
    logger.warn("Brevo API key not configured — skipping down alert");
    return;
  }

  const html = `${BRAND}${BRAND_HEADER}
    <div style="background:#1a0a0a;border:1px solid #ef444455;border-radius:6px;padding:20px;margin-bottom:20px;">
      <div style="font-size:10px;color:#ef4444;text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;">⚠ Monitor Down</div>
      <div style="font-size:24px;font-weight:700;color:#ffffff;margin-bottom:6px;">${monitorName}</div>
      <a href="${monitorUrl}" style="font-size:12px;color:#ef4444;text-decoration:none;">${monitorUrl}</a>
      ${error ? `<div style="margin-top:12px;font-size:11px;color:#ef4444;background:#2a0a0a;padding:10px;border-radius:4px;font-family:'Courier New',monospace;">${error}</div>` : ""}
    </div>
    <div style="font-size:12px;color:#6b7280;line-height:1.7;">
      Hey ${toName}, your endpoint went offline. wolfXmonitor will keep checking and notify you the moment it recovers.
    </div>
  ${BRAND_FOOTER}`;

  try {
    await sendEmail(config, {
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: toEmail, name: toName }],
      subject: `[DOWN] ${monitorName} is unreachable`,
      htmlContent: html,
    });
    logger.info({ toEmail, monitorName }, "Down alert email sent");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, toEmail, monitorName }, "Failed to send down alert email");
  }
}

export async function sendDeleteAlert(opts: {
  toEmail: string;
  toName: string;
  monitorName: string;
  monitorUrl: string;
}): Promise<void> {
  const { toEmail, toName, monitorName, monitorUrl } = opts;
  const config = await getEmailConfig();
  if (!config) {
    logger.warn("Brevo API key not configured — skipping delete alert");
    return;
  }

  const html = `${BRAND}${BRAND_HEADER}
    <div style="background:#0a0a12;border:1px solid #6b728033;border-radius:6px;padding:20px;margin-bottom:20px;">
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;">Monitor Removed</div>
      <div style="font-size:24px;font-weight:700;color:#ffffff;margin-bottom:6px;text-decoration:line-through;opacity:0.6;">${monitorName}</div>
      <div style="font-size:12px;color:#6b7280;">${monitorUrl}</div>
    </div>
    <div style="font-size:12px;color:#6b7280;line-height:1.7;">
      Hey ${toName}, the monitor for <strong style="color:#d1ffd6;">${monitorName}</strong> has been permanently deleted along with all its ping history. wolfXmonitor is no longer watching this endpoint.
    </div>
  ${BRAND_FOOTER}`;

  try {
    await sendEmail(config, {
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: toEmail, name: toName }],
      subject: `Monitor deleted: ${monitorName}`,
      htmlContent: html,
    });
    logger.info({ toEmail, monitorName }, "Delete alert email sent");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, toEmail, monitorName }, "Failed to send delete alert email");
  }
}

export async function sendRecoveryAlert(opts: {
  toEmail: string;
  toName: string;
  monitorName: string;
  monitorUrl: string;
  responseTimeMs?: number | null;
}): Promise<void> {
  const { toEmail, toName, monitorName, monitorUrl, responseTimeMs } = opts;
  const config = await getEmailConfig();
  if (!config) {
    logger.warn("Brevo API key not configured — skipping recovery alert");
    return;
  }

  const html = `${BRAND}${BRAND_HEADER}
    <div style="background:#0a1a0e;border:1px solid #22c55e55;border-radius:6px;padding:20px;margin-bottom:20px;">
      <div style="font-size:10px;color:#22c55e;text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;">✓ Monitor Recovered</div>
      <div style="font-size:24px;font-weight:700;color:#ffffff;margin-bottom:6px;">${monitorName}</div>
      <a href="${monitorUrl}" style="font-size:12px;color:#22c55e;text-decoration:none;">${monitorUrl}</a>
      ${responseTimeMs ? `<div style="margin-top:12px;font-size:13px;color:#22c55e;font-weight:600;">Response time: ${responseTimeMs}ms</div>` : ""}
    </div>
    <div style="font-size:12px;color:#6b7280;line-height:1.7;">
      Good news, ${toName}! <strong style="color:#d1ffd6;">${monitorName}</strong> is back online and responding normally. wolfXmonitor continues watching.
    </div>
  ${BRAND_FOOTER}`;

  try {
    await sendEmail(config, {
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: toEmail, name: toName }],
      subject: `[RECOVERED] ${monitorName} is back online`,
      htmlContent: html,
    });
    logger.info({ toEmail, monitorName }, "Recovery alert email sent");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, toEmail, monitorName }, "Failed to send recovery alert email");
  }
}
