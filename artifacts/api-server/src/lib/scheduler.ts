import { db, monitorsTable, pingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { pingUrl } from "./pinger";
import { logger } from "./logger";
import { sendDownAlert, sendRecoveryAlert } from "./mailer";
import {
  sendTelegramMessage,
  sendWhatsAppMessage,
  sendDiscordAlert,
  buildDownMessage,
  buildDownMessagePlain,
  buildRecoveryMessage,
  buildRecoveryMessagePlain,
} from "./notifier";

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
          if (user.telegramChatId) {
            await sendTelegramMessage(
              user.telegramChatId,
              buildDownMessage(monitor.name, url, result.error)
            );
          }
          if (user.whatsappPhone) {
            await sendWhatsAppMessage(
              user.whatsappPhone,
              buildDownMessagePlain(monitor.name, url, result.error)
            );
          }
          if (user.discordWebhookUrl) {
            await sendDiscordAlert(user.discordWebhookUrl, "down", monitor.name, url, { error: result.error, statusCode: result.statusCode });
          }
        } else if (justRecovered) {
          await sendRecoveryAlert({
            toEmail: emailTo,
            toName: user.name,
            monitorName: monitor.name,
            monitorUrl: url,
            responseTimeMs: result.responseTimeMs,
          });
          if (user.telegramChatId) {
            await sendTelegramMessage(
              user.telegramChatId,
              buildRecoveryMessage(monitor.name, url, result.responseTimeMs)
            );
          }
          if (user.whatsappPhone) {
            await sendWhatsAppMessage(
              user.whatsappPhone,
              buildRecoveryMessagePlain(monitor.name, url, result.responseTimeMs)
            );
          }
          if (user.discordWebhookUrl) {
            await sendDiscordAlert(user.discordWebhookUrl, "recovery", monitor.name, url, { responseTimeMs: result.responseTimeMs });
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err, monitorId, url }, "Ping error");
  }
}

export function scheduleMonitor(id: number, url: string, intervalMinutes: number, immediate = false): void {
  if (activeTimers.has(id)) {
    clearInterval(activeTimers.get(id)!);
  }
  const intervalMs = intervalMinutes * 60 * 1000;
  const timer = setInterval(() => runPing(id, url), intervalMs);
  activeTimers.set(id, timer);
  if (immediate) {
    runPing(id, url).catch((err) => logger.error({ err, monitorId: id }, "Immediate ping error"));
  }
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
      // Fire an immediate ping for monitors that have never been checked
      const neverPinged = !monitor.lastPingedAt;
      scheduleMonitor(monitor.id, monitor.url, monitor.intervalMinutes, neverPinged);
    }
  }
  logger.info({ count: monitors.filter((m) => m.active).length }, "Scheduler initialized");
}
