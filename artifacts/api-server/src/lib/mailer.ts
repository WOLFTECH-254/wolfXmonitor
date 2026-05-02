import axios from "axios";
import { logger } from "./logger";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function getApiKey(): string | undefined {
  return process.env.BREVO_API_KEY;
}

const SENDER = {
  name: process.env.BREVO_SENDER_NAME ?? "wolfXmonitor",
  email: process.env.BREVO_SENDER_EMAIL ?? "777wolftech@gmail.com",
};

async function sendEmail(payload: object): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn("BREVO_API_KEY not set — skipping email notification");
    return;
  }
  await axios.post(BREVO_API_URL, payload, {
    headers: {
      "api-key": apiKey,
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

export async function sendWelcomeAlert(opts: {
  toEmail: string;
  toName: string;
  monitorName: string;
  monitorUrl: string;
  intervalMinutes: number;
}): Promise<void> {
  const { toEmail, toName, monitorName, monitorUrl, intervalMinutes } = opts;

  const html = `${BRAND}${BRAND_HEADER}
    <div style="background:#0f1a12;border:1px solid #22c55e33;border-radius:6px;padding:20px;margin-bottom:20px;">
      <div style="font-size:10px;color:#22c55e;text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;">Monitor Active</div>
      <div style="font-size:24px;font-weight:700;color:#ffffff;margin-bottom:6px;">${monitorName}</div>
      <a href="${monitorUrl}" style="font-size:12px;color:#22c55e;text-decoration:none;">${monitorUrl}</a>
    </div>
    <div style="background:#0a120c;border:1px solid #1a3a22;border-radius:6px;padding:16px;margin-bottom:20px;">
      <table style="width:100%;font-size:12px;color:#9ca3af;">
        <tr>
          <td style="padding:4px 0;">Check interval</td>
          <td style="text-align:right;color:#d1ffd6;font-weight:600;">Every ${intervalMinutes} minute${intervalMinutes !== 1 ? "s" : ""}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;">Notifications</td>
          <td style="text-align:right;color:#d1ffd6;font-weight:600;">Enabled → ${toEmail}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;">Status</td>
          <td style="text-align:right;color:#22c55e;font-weight:700;">● WATCHING</td>
        </tr>
      </table>
    </div>
    <div style="font-size:12px;color:#6b7280;line-height:1.7;">
      Hey ${toName}, wolfXmonitor is now watching <strong style="color:#d1ffd6;">${monitorName}</strong>. 
      You'll be alerted immediately if it goes down, and again when it recovers. You won't miss a thing.
    </div>
  ${BRAND_FOOTER}`;

  try {
    await sendEmail({
      sender: SENDER,
      to: [{ email: toEmail, name: toName }],
      subject: `✓ Now watching: ${monitorName}`,
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

  const html = `${BRAND}${BRAND_HEADER}
    <div style="background:#1a0a0a;border:1px solid #ef444433;border-radius:6px;padding:20px;margin-bottom:20px;">
      <div style="font-size:10px;color:#ef4444;text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;">⚠ Monitor Down</div>
      <div style="font-size:24px;font-weight:700;color:#ffffff;margin-bottom:6px;">${monitorName}</div>
      <a href="${monitorUrl}" style="font-size:12px;color:#ef4444;text-decoration:none;">${monitorUrl}</a>
      ${error ? `<div style="margin-top:12px;font-size:11px;color:#ef4444;background:#2a0a0a;padding:10px 14px;border-radius:4px;border:1px solid #3a1010;font-family:monospace;">${error}</div>` : ""}
    </div>
    <div style="font-size:12px;color:#6b7280;line-height:1.7;">
      Hey ${toName}, your endpoint went offline. wolfXmonitor will keep checking and notify you the moment it recovers.
    </div>
  ${BRAND_FOOTER}`;

  try {
    await sendEmail({
      sender: SENDER,
      to: [{ email: toEmail, name: toName }],
      subject: `⚠ DOWN: ${monitorName} is unreachable`,
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
    await sendEmail({
      sender: SENDER,
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
    await sendEmail({
      sender: SENDER,
      to: [{ email: toEmail, name: toName }],
      subject: `✓ RECOVERED: ${monitorName} is back online`,
      htmlContent: html,
    });
    logger.info({ toEmail, monitorName }, "Recovery alert email sent");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, toEmail, monitorName }, "Failed to send recovery alert email");
  }
}
