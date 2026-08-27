import axios from "axios";
import { logger } from "./logger";
import { getEmailConfig } from "./mailer";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_SECURITY_EMAIL = "777wolfsilent8@gmail.com";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

async function getSecurityEmail(): Promise<string> {
  try {
    const rows = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "security_alert_email"));
    return rows[0]?.value?.trim() || DEFAULT_SECURITY_EMAIL;
  } catch {
    return DEFAULT_SECURITY_EMAIL;
  }
}

const TYPE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  login_fail:       { label: "Failed Login",         color: "#f59e0b", emoji: "⚠" },
  brute_force:      { label: "Brute Force Attack",   color: "#ef4444", emoji: "🚨" },
  rate_limit:       { label: "Rate Limit Hit",       color: "#f97316", emoji: "🛑" },
  blocked_ip:       { label: "Blocked IP Access",    color: "#ef4444", emoji: "🚫" },
  suspicious_agent: { label: "Suspicious Scanner",   color: "#8b5cf6", emoji: "🔍" },
};

const COOLDOWNS = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000;

export async function sendSecurityAlert(opts: {
  type: string;
  ip: string;
  path?: string;
  details?: string;
}): Promise<void> {
  const { type, ip, path, details } = opts;
  const key = `${type}:${ip}`;
  const now = Date.now();
  if ((COOLDOWNS.get(key) ?? 0) + COOLDOWN_MS > now) return;
  COOLDOWNS.set(key, now);

  const [config, securityEmail] = await Promise.all([getEmailConfig(), getSecurityEmail()]);
  if (!config) {
    logger.warn("Brevo not configured — skipping security alert");
    return;
  }

  const meta = TYPE_LABELS[type] ?? { label: type, color: "#6b7280", emoji: "🔔" };
  const ts = new Date().toUTCString();

  const html = `
<div style="font-family:'Courier New',monospace;max-width:560px;margin:0 auto;background:#080e0a;color:#d1ffd6;padding:32px;border-radius:8px;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
    <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:1px;">Guardi<span style="color:#22c55e">X</span></span>
  </div>
  <div style="font-size:10px;color:#4b7a55;letter-spacing:3px;text-transform:uppercase;margin-bottom:28px;border-bottom:1px solid #1a3a22;padding-bottom:16px;">Security Alert</div>
  <div style="background:#0f0f0f;border:1px solid ${meta.color}44;border-left:3px solid ${meta.color};border-radius:6px;padding:20px;margin-bottom:20px;">
    <div style="font-size:10px;color:${meta.color};text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;">${meta.emoji} ${meta.label}</div>
    <table style="width:100%;font-size:12px;border-collapse:collapse;">
      <tr><td style="color:#6b7280;padding:4px 0;width:100px;">IP Address</td><td style="color:#fff;font-weight:700;">${ip}</td></tr>
      ${path ? `<tr><td style="color:#6b7280;padding:4px 0;">Path</td><td style="color:#d1ffd6;">${path}</td></tr>` : ""}
      <tr><td style="color:#6b7280;padding:4px 0;">Time</td><td style="color:#d1ffd6;">${ts}</td></tr>
      ${details ? `<tr><td style="color:#6b7280;padding:4px 0;">Details</td><td style="color:#d1ffd6;">${details}</td></tr>` : ""}
    </table>
  </div>
  <div style="font-size:11px;color:#6b7280;line-height:1.7;margin-bottom:16px;">
    Log into your admin panel to review and block this IP if needed.<br/>
    <a href="https://monitor.xwolf.space/admin?tab=security" style="color:#22c55e;">monitor.xwolf.space/admin → Security tab</a>
  </div>
  <div style="margin-top:28px;padding-top:16px;border-top:1px solid #1a3a22;font-size:10px;color:#4b5563;text-align:center;letter-spacing:1px;">
    GuardiX Security · Watching 24/7
  </div>
</div>`;

  try {
    await axios.post(BREVO_API_URL, {
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: securityEmail, name: "GuardiX Admin" }],
      subject: `${meta.emoji} GuardiX Security: ${meta.label} from ${ip}`,
      htmlContent: html,
    }, {
      headers: { "api-key": config.apiKey, "content-type": "application/json", accept: "application/json" },
      timeout: 8000,
    });
    logger.info({ type, ip, to: securityEmail }, "Security alert email sent");
  } catch (err: unknown) {
    logger.error({ err: err instanceof Error ? err.message : String(err), type, ip }, "Failed to send security alert");
  }
}
