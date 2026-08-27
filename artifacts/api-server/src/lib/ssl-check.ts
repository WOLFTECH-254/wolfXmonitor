import tls from "node:tls";
import { db, monitorsTable, usersTable } from "@workspace/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { logger } from "./logger";
import { resolvePlan } from "./plans";
import { featureEnabled } from "./plan-enforcement";
import { sendSslExpiryAlert } from "./mailer";

export interface CertInfo {
  status: "valid" | "expiring" | "expired" | "error";
  expiresAt: Date | null;
  daysRemaining: number | null;
  issuer: string | null;
}

const EXPIRING_THRESHOLD_DAYS = 14;

/** Read the TLS certificate for an https URL and classify its expiry. */
export function checkCertificate(rawUrl: string, timeoutMs = 10_000): Promise<CertInfo> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      resolve({ status: "error", expiresAt: null, daysRemaining: null, issuer: null });
      return;
    }
    if (url.protocol !== "https:") {
      resolve({ status: "error", expiresAt: null, daysRemaining: null, issuer: null });
      return;
    }
    const host = url.hostname;
    const port = url.port ? Number(url.port) : 443;

    const socket = tls.connect(
      { host, port, servername: host, rejectUnauthorized: false, timeout: timeoutMs },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) {
          resolve({ status: "error", expiresAt: null, daysRemaining: null, issuer: null });
          return;
        }
        const expiresAt = new Date(cert.valid_to);
        const daysRemaining = Math.floor((expiresAt.getTime() - Date.now()) / 86_400_000);
        const rawIssuer = cert.issuer && (cert.issuer.O || cert.issuer.CN);
        const issuer = Array.isArray(rawIssuer) ? rawIssuer[0] ?? null : rawIssuer || null;
        const status =
          daysRemaining < 0 ? "expired"
          : daysRemaining <= EXPIRING_THRESHOLD_DAYS ? "expiring"
          : "valid";
        resolve({ status, expiresAt, daysRemaining, issuer });
      },
    );
    socket.on("error", () => {
      resolve({ status: "error", expiresAt: null, daysRemaining: null, issuer: null });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ status: "error", expiresAt: null, daysRemaining: null, issuer: null });
    });
  });
}

/** Recheck SSL for every eligible monitor. Runs on a slow tick (~6h). */
export async function runSslChecks(): Promise<void> {
  const monitors = await db
    .select()
    .from(monitorsTable)
    .where(and(eq(monitorsTable.sslCheckEnabled, true), isNotNull(monitorsTable.userId)));
  if (monitors.length === 0) return;

  for (const monitor of monitors) {
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, monitor.userId!));
      if (!user) continue;
      const plan = await resolvePlan(user);
      if (!featureEnabled(plan, "ssl")) continue; // plan no longer allows it — skip silently

      const info = await checkCertificate(monitor.url);
      await db
        .update(monitorsTable)
        .set({
          sslStatus: info.status,
          sslExpiresAt: info.expiresAt,
          sslDaysRemaining: info.daysRemaining,
          sslIssuer: info.issuer,
          sslLastCheckedAt: new Date(),
        })
        .where(eq(monitorsTable.id, monitor.id));

      const shouldAlert =
        (info.status === "expiring" || info.status === "expired") &&
        user.notificationsEnabled &&
        (!monitor.sslLastNotifiedAt || Date.now() - monitor.sslLastNotifiedAt.getTime() > 3 * 86_400_000);

      if (shouldAlert) {
        await db.update(monitorsTable).set({ sslLastNotifiedAt: new Date() }).where(eq(monitorsTable.id, monitor.id));
        sendSslExpiryAlert({
          toEmail: user.notificationEmail ?? user.email,
          toName: user.name,
          monitorName: monitor.name,
          monitorUrl: monitor.url,
          daysRemaining: info.daysRemaining ?? 0,
          expiresAt: info.expiresAt,
        }).catch(() => {});
      }
    } catch (err) {
      logger.warn({ err: String(err), monitorId: monitor.id }, "SSL check failed");
    }
  }
  logger.info({ count: monitors.length }, "SSL checks completed");
}
