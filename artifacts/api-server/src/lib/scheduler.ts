import { db, monitorsTable, pingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { pingUrl } from "./pinger";
import { logger } from "./logger";
import { sendDownAlert, sendRecoveryAlert } from "./mailer";

const activeTimers = new Map<number, NodeJS.Timeout>();

async function runPing(monitorId: number, url: string): Promise<void> {
  try {
    const [monitor] = await db.select().from(monitorsTable).where(eq(monitorsTable.id, monitorId));
    if (!monitor) return;

    const previousStatus = monitor.lastStatus;
    const result = await pingUrl(url);

    await db.insert(pingsTable).values({
      monitorId,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.statusCode,
      error: result.error,
    });

    const updateData: Partial<typeof monitorsTable.$inferInsert> = {
      lastPingedAt: new Date(),
      lastStatus: result.status,
      lastResponseTimeMs: result.responseTimeMs,
    };

    const justWentDown = result.status === "down" && previousStatus !== "down";
    const justRecovered = result.status === "up" && previousStatus === "down";
    if (justWentDown) {
      updateData.lastNotifiedDownAt = new Date();
    }

    await db.update(monitorsTable).set(updateData).where(eq(monitorsTable.id, monitorId));

    logger.info({ monitorId, url, status: result.status, responseTimeMs: result.responseTimeMs }, "Ping completed");

    if (monitor.userId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, monitor.userId));
      if (user?.notificationsEnabled) {
        const emailTo = user.notificationEmail ?? user.email;
        if (justWentDown) {
          await sendDownAlert({
            toEmail: emailTo,
            toName: user.name,
            monitorName: monitor.name,
            monitorUrl: url,
            error: result.error,
          });
        } else if (justRecovered) {
          await sendRecoveryAlert({
            toEmail: emailTo,
            toName: user.name,
            monitorName: monitor.name,
            monitorUrl: url,
            responseTimeMs: result.responseTimeMs,
          });
        }
      }
    }
  } catch (err) {
    logger.error({ err, monitorId, url }, "Ping error");
  }
}

export function scheduleMonitor(id: number, url: string, intervalMinutes: number): void {
  if (activeTimers.has(id)) {
    clearInterval(activeTimers.get(id)!);
  }
  const intervalMs = intervalMinutes * 60 * 1000;
  const timer = setInterval(() => runPing(id, url), intervalMs);
  activeTimers.set(id, timer);
}

export function unscheduleMonitor(id: number): void {
  const timer = activeTimers.get(id);
  if (timer) {
    clearInterval(timer);
    activeTimers.delete(id);
  }
}

export async function initScheduler(): Promise<void> {
  const monitors = await db.select().from(monitorsTable);
  for (const monitor of monitors) {
    if (monitor.active) {
      scheduleMonitor(monitor.id, monitor.url, monitor.intervalMinutes);
    }
  }
  logger.info({ count: monitors.filter((m) => m.active).length }, "Scheduler initialized");
}
