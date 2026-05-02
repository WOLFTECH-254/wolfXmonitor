import { db, monitorsTable, pingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { pingUrl } from "./pinger";
import { logger } from "./logger";

const activeTimers = new Map<number, NodeJS.Timeout>();

async function runPing(monitorId: number, url: string): Promise<void> {
  try {
    const result = await pingUrl(url);
    await db.insert(pingsTable).values({
      monitorId,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.statusCode,
      error: result.error,
    });
    await db
      .update(monitorsTable)
      .set({
        lastPingedAt: new Date(),
        lastStatus: result.status,
        lastResponseTimeMs: result.responseTimeMs,
      })
      .where(eq(monitorsTable.id, monitorId));
    logger.info({ monitorId, url, status: result.status, responseTimeMs: result.responseTimeMs }, "Ping completed");
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
