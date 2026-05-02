import axios from "axios";
import { logger } from "./logger";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendDownAlert(opts: {
  toEmail: string;
  toName: string;
  monitorName: string;
  monitorUrl: string;
  error?: string | null;
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    logger.warn("BREVO_API_KEY not set — skipping email notification");
    return;
  }

  const { toEmail, toName, monitorName, monitorUrl, error } = opts;

  const html = `
    <div style="font-family:'Courier New',monospace;background:#080e0a;color:#d1ffd6;padding:32px;border-radius:6px;max-width:520px">
      <div style="font-size:22px;font-weight:700;color:#22c55e;margin-bottom:8px;letter-spacing:1px;">
        wolf<span style="color:#22c55e">X</span>monitor
      </div>
      <div style="font-size:11px;color:#6b7280;letter-spacing:2px;margin-bottom:28px;text-transform:uppercase;">
        Uptime Alert
      </div>
      <div style="background:#0f1a12;border:1px solid #1a3a22;border-radius:4px;padding:20px;margin-bottom:24px;">
        <div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Monitor Down</div>
        <div style="font-size:22px;font-weight:700;color:#ffffff;margin-bottom:4px;">${monitorName}</div>
        <a href="${monitorUrl}" style="font-size:12px;color:#22c55e;text-decoration:none;">${monitorUrl}</a>
        ${error ? `<div style="margin-top:12px;font-size:11px;color:#ef4444;background:#1a0a0a;padding:8px 12px;border-radius:3px;border:1px solid #3a1010;">${error}</div>` : ""}
      </div>
      <div style="font-size:11px;color:#4b5563;text-align:center;">
        Your endpoint went offline. Check it immediately.<br/>
        wolfXmonitor is still watching.
      </div>
    </div>
  `;

  try {
    await axios.post(
      BREVO_API_URL,
      {
        sender: { name: "wolfXmonitor", email: "notifications@wolfxmonitor.app" },
        to: [{ email: toEmail, name: toName }],
        subject: `⚠ ${monitorName} is DOWN`,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
      },
    );
    logger.info({ toEmail, monitorName }, "Down alert email sent");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, toEmail, monitorName }, "Failed to send down alert email");
  }
}
