import { db, monitorsTable, pingsTable, usersTable, settingsTable } from "@workspace/db";
import type { Monitor } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { pingUrl } from "./pinger";
import { logger } from "./logger";
import { sendDownAlert, sendRecoveryAlert } from "./mailer";
import {
  sendTelegramMessage, sendWhatsAppMessage, sendDiscordAlert,
  buildDownMessage, buildDownMessagePlain, buildRecoveryMessage, buildRecoveryMessagePlain,
} from "./notifier";
import { resolvePlan } from "./plans";
import { featureEnabled, PLATFORM_MIN_SECONDS } from "./plan-enforcement";
import { runSslChecks } from "./ssl-check";
import { runRetention } from "./retention";

/**
 * Scheduler v2 — a single tick instead of one timer per monitor.
 *
 * Every PING_TICK_MS the tick asks the database for monitors whose next check
 * is due (based on check_interval_seconds) and runs them with a bounded
 * concurrency pool. This scales to thousands of monitors with a fixed number
 * of timers and predictable load, and it picks up create/update/delete/pause
 * automatically because state lives in the DB.
 */
const PING_TICK_MS = 5_000;
const BATCH_LIMIT = 300;          // monitors considered per tick
const MAX_CONCURRENT = 25;        // simultaneous outbound checks
const SSL_TICK_MS = 6 * 60 * 60 * 1000;
const RETENTION_TICK_MS = 60 * 60 * 1000;

const inFlight = new Set<number>();
let timers: NodeJS.Timeout[] = [];

async function dispatchAlerts(monitor: Monitor, prevStatus: string, result: Awaited<ReturnType<typeof pingUrl>>) {
  if (!monitor.userId) return;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, monitor.userId));
  if (!user || !user.notificationsEnabled) return;

  const plan = await resolvePlan(user);
  const justWentDown = result.status === "down" && prevStatus !== "down";
  const justRecovered = result.status === "up" && prevStatus === "down";
  if (!justWentDown && !justRecovered) return;

  const emailTo = user.notificationEmail ?? user.email;
  const canWebhook = featureEnabled(plan, "webhook");
  const canTelegram = featureEnabled(plan, "telegram");

  if (justWentDown) {
    if (featureEnabled(plan, "email")) {
      await sendDownAlert({ toEmail: emailTo, toName: user.name, monitorName: monitor.name, monitorUrl: monitor.url, error: result.error });
    }
    if (canTelegram && user.telegramChatId) {
      await sendTelegramMessage(user.telegramChatId, buildDownMessage(monitor.name, monitor.url, result.error));
    }
    if (user.whatsappPhone) {
      await sendWhatsAppMessage(user.whatsappPhone, buildDownMessagePlain(monitor.name, monitor.url, result.error));
    }
    if (canWebhook && user.discordWebhookUrl) {
      await sendDiscordAlert(user.discordWebhookUrl, "down", monitor.name, monitor.url, { error: result.error, statusCode: result.statusCode });
    }
  } else {
    if (featureEnabled(plan, "email")) {
      await sendRecoveryAlert({ toEmail: emailTo, toName: user.name, monitorName: monitor.name, monitorUrl: monitor.url, responseTimeMs: result.responseTimeMs });
    }
    if (canTelegram && user.telegramChatId) {
      await sendTelegramMessage(user.telegramChatId, buildRecoveryMessage(monitor.name, monitor.url, result.responseTimeMs));
    }
    if (user.whatsappPhone) {
      await sendWhatsAppMessage(user.whatsappPhone, buildRecoveryMessagePlain(monitor.name, monitor.url, result.responseTimeMs));
    }
    if (canWebhook && user.discordWebhookUrl) {
      await sendDiscordAlert(user.discordWebhookUrl, "recovery", monitor.name, monitor.url, { responseTimeMs: result.responseTimeMs });
    }
  }
}

async function runCheck(monitor: Monitor): Promise<void> {
  try {
    const prevStatus = monitor.lastStatus;
    const result = await pingUrl(monitor.url);

    await db.insert(pingsTable).values({
      monitorId: monitor.id,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.statusCode,
      error: result.error,
    });

    const update: Partial<typeof monitorsTable.$inferInsert> = {
      lastPingedAt: new Date(),
      lastStatus: result.status,
      lastResponseTimeMs: result.responseTimeMs,
    };
    if (result.status === "down" && prevStatus !== "down") update.lastNotifiedDownAt = new Date();
    await db.update(monitorsTable).set(update).where(eq(monitorsTable.id, monitor.id));

    await dispatchAlerts(monitor, prevStatus, result);
  } catch (err) {
    logger.error({ err: String(err), monitorId: monitor.id }, "Check failed");
  } finally {
    inFlight.delete(monitor.id);
  }
}

async function pingTick(): Promise<void> {
  try {
    // Monitors whose next check is due. `check_interval_seconds` is authoritative;
    // the platform floor is enforced here too so a bad row can't hammer a target.
    const rows = await db
      .select()
      .from(monitorsTable)
      .where(sql`
        ${monitorsTable.active} = true
        AND (
          ${monitorsTable.lastPingedAt} IS NULL
          OR ${monitorsTable.lastPingedAt} <= now() - (GREATEST(${monitorsTable.checkIntervalSeconds}, ${PLATFORM_MIN_SECONDS}) * interval '1 second')
        )
      `)
      .orderBy(sql`${monitorsTable.lastPingedAt} asc nulls first`)
      .limit(BATCH_LIMIT);

    const due = rows.filter((m) => !inFlight.has(m.id));
    if (due.length === 0) return;

    let idx = 0;
    const worker = async () => {
      while (idx < due.length) {
        const m = due[idx++];
        inFlight.add(m.id);
        await runCheck(m);
      }
    };
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, due.length) }, worker));
  } catch (err) {
    logger.error({ err: String(err) }, "pingTick error");
  }
}

/** One-time: derive check_interval_seconds from the legacy interval_minutes. */
async function backfillIntervals(): Promise<void> {
  const [flag] = await db.select().from(settingsTable).where(eq(settingsTable.key, "monitors_interval_backfilled"));
  if (flag?.value === "1") return;
  await db.execute(sql`
    UPDATE monitors
    SET check_interval_seconds = GREATEST(COALESCE(interval_minutes, 5) * 60, ${PLATFORM_MIN_SECONDS})
  `);
  await db
    .insert(settingsTable)
    .values({ key: "monitors_interval_backfilled", value: "1" })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: "1" } });
  logger.info("Backfilled monitor check intervals from interval_minutes");
}

export async function startBackgroundJobs(): Promise<void> {
  await backfillIntervals();

  timers.push(setInterval(() => { void pingTick(); }, PING_TICK_MS));
  void pingTick();

  timers.push(setInterval(() => { runSslChecks().catch((e) => logger.warn({ e: String(e) }, "ssl tick")); }, SSL_TICK_MS));
  setTimeout(() => { runSslChecks().catch(() => {}); }, 30_000);

  timers.push(setInterval(() => { runRetention().catch((e) => logger.warn({ e: String(e) }, "retention tick")); }, RETENTION_TICK_MS));
  setTimeout(() => { runRetention().catch(() => {}); }, 60_000);

  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(monitorsTable).where(eq(monitorsTable.active, true));
  logger.info({ activeMonitors: Number(n), tickMs: PING_TICK_MS }, "Scheduler v2 started");
}

export function stopBackgroundJobs(): void {
  timers.forEach(clearInterval);
  timers = [];
}

/** Kept for boot compatibility. */
export async function initScheduler(): Promise<void> {
  await startBackgroundJobs();
}

/* eslint-disable @typescript-eslint/no-unused-vars */
/** @deprecated The DB-driven tick makes per-monitor scheduling unnecessary. */
export function scheduleMonitor(_id: number, _url: string, _intervalMinutes: number, _immediate = false): void {}
/** @deprecated */
export function unscheduleMonitor(_id: number): void {}
