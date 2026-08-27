import { Router } from "express";
import { db, monitorsTable, pingsTable, usersTable } from "@workspace/db";
import { eq, desc, count, and, gte, sql } from "drizzle-orm";
import {
  CreateMonitorBody,
  UpdateMonitorBody,
  GetMonitorParams,
  DeleteMonitorParams,
  UpdateMonitorParams,
  GetMonitorPingsParams,
  GetMonitorPingsQueryParams,
  GetMonitorStatsParams,
  TriggerPingParams,
} from "@workspace/api-zod";
import { pingUrl } from "../lib/pinger";
import { requireAuth } from "../middlewares/auth";
import { sendDownAlert, sendWelcomeAlert, sendDeleteAlert } from "../lib/mailer";
import { sendTelegramMessage, sendWhatsAppMessage, sendDiscordAlert, buildDownMessage, buildDownMessagePlain } from "../lib/notifier";
import { resolvePlan } from "../lib/plans";
import { assertCanCreateMonitor, assertIntervalAllowed, assertFeatureAllowed, recomputeOverLimit, PlanError } from "../lib/plan-enforcement";
import type { Response } from "express";

const router = Router();

function sendPlanError(err: unknown, res: Response): boolean {
  if (err instanceof PlanError) {
    res.status(err.status).json({ error: err.message, limitReached: true, upgrade: true, feature: err.feature });
    return true;
  }
  return false;
}

function requestedIntervalSeconds(body: { checkIntervalSeconds?: unknown; intervalMinutes?: unknown }, fallback: number): number {
  if (typeof body.checkIntervalSeconds === "number" && body.checkIntervalSeconds > 0) return body.checkIntervalSeconds;
  if (typeof body.intervalMinutes === "number" && body.intervalMinutes > 0) return Math.round(body.intervalMinutes * 60);
  return fallback;
}

router.get("/monitors", requireAuth, async (req, res) => {
  const monitors = await db
    .select()
    .from(monitorsTable)
    .where(eq(monitorsTable.userId, req.session.userId!))
    .orderBy(desc(monitorsTable.createdAt));
  res.json(monitors);
});

router.post("/monitors", requireAuth, async (req, res) => {
  const body = CreateMonitorBody.parse(req.body);
  const userId = req.session.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  let checkIntervalSeconds = 300;
  try {
    const plan = await assertCanCreateMonitor(userId);
    checkIntervalSeconds = assertIntervalAllowed(plan, requestedIntervalSeconds(req.body, plan.checkIntervalSeconds));
    if (req.body?.sslCheckEnabled === true) assertFeatureAllowed(plan, "ssl");
  } catch (err) {
    if (sendPlanError(err, res)) return;
    throw err;
  }

  const [monitor] = await db
    .insert(monitorsTable)
    .values({
      userId,
      name: body.name,
      url: body.url,
      checkIntervalSeconds,
      intervalMinutes: Math.max(1, Math.round(checkIntervalSeconds / 60)),
      active: body.active ?? true,
      sslCheckEnabled: req.body?.sslCheckEnabled === true,
    })
    .returning();

  if (user?.notificationsEnabled) {
    const emailTo = user.notificationEmail ?? user.email;
    sendWelcomeAlert({
      toEmail: emailTo,
      toName: user.name,
      monitorName: monitor.name,
      monitorUrl: monitor.url,
    }).catch(() => {});
  }

  res.status(201).json(monitor);
});

router.get("/monitors/:id", requireAuth, async (req, res) => {
  const { id } = GetMonitorParams.parse({ id: Number(req.params.id) });
  const [monitor] = await db
    .select()
    .from(monitorsTable)
    .where(and(eq(monitorsTable.id, id), eq(monitorsTable.userId, req.session.userId!)));
  if (!monitor) {
    res.status(404).json({ error: "Monitor not found" });
    return;
  }
  res.json(monitor);
});

router.put("/monitors/:id", requireAuth, async (req, res) => {
  const { id } = UpdateMonitorParams.parse({ id: Number(req.params.id) });
  const body = UpdateMonitorBody.parse(req.body);
  const userId = req.session.userId!;

  const [existing] = await db
    .select()
    .from(monitorsTable)
    .where(and(eq(monitorsTable.id, id), eq(monitorsTable.userId, userId)));
  if (!existing) { res.status(404).json({ error: "Monitor not found" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const plan = await resolvePlan(user);

  const updates: Partial<typeof monitorsTable.$inferInsert> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.url !== undefined) updates.url = body.url;
  if (body.active !== undefined) updates.active = body.active;

  const intervalGiven =
    (typeof req.body?.checkIntervalSeconds === "number") || (body.intervalMinutes !== undefined);
  try {
    if (intervalGiven) {
      const seconds = assertIntervalAllowed(plan, requestedIntervalSeconds(req.body, existing.checkIntervalSeconds));
      updates.checkIntervalSeconds = seconds;
      updates.intervalMinutes = Math.max(1, Math.round(seconds / 60));
    }
    if (req.body?.sslCheckEnabled === true && !existing.sslCheckEnabled) {
      assertFeatureAllowed(plan, "ssl");
    }
  } catch (err) {
    if (sendPlanError(err, res)) return;
    throw err;
  }
  if (typeof req.body?.sslCheckEnabled === "boolean") updates.sslCheckEnabled = req.body.sslCheckEnabled;

  const [monitor] = await db
    .update(monitorsTable)
    .set(updates)
    .where(and(eq(monitorsTable.id, id), eq(monitorsTable.userId, userId)))
    .returning();
  res.json(monitor);
});

router.delete("/monitors/:id", requireAuth, async (req, res) => {
  const { id } = DeleteMonitorParams.parse({ id: Number(req.params.id) });
  const [monitor] = await db
    .select()
    .from(monitorsTable)
    .where(and(eq(monitorsTable.id, id), eq(monitorsTable.userId, req.session.userId!)));
  if (!monitor) {
    res.status(404).json({ error: "Monitor not found" });
    return;
  }
  await db.delete(monitorsTable).where(eq(monitorsTable.id, id));
  // Removing a monitor may bring an over-limit account back into compliance.
  if (monitor.userId) await recomputeOverLimit(monitor.userId).catch(() => {});

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, monitor.userId!));
  if (user?.notificationsEnabled) {
    sendDeleteAlert({
      toEmail: user.notificationEmail ?? user.email,
      toName: user.name,
      monitorName: monitor.name,
      monitorUrl: monitor.url,
    }).catch(() => {});
  }

  res.status(204).send();
});

router.get("/monitors/:id/pings", requireAuth, async (req, res) => {
  const { id } = GetMonitorPingsParams.parse({ id: Number(req.params.id) });
  const query = GetMonitorPingsQueryParams.parse(req.query);
  const limit = query.limit ?? 50;
  const pings = await db
    .select()
    .from(pingsTable)
    .where(eq(pingsTable.monitorId, id))
    .orderBy(desc(pingsTable.createdAt))
    .limit(limit);
  res.json(pings);
});

router.get("/monitors/:id/stats", requireAuth, async (req, res) => {
  const { id } = GetMonitorStatsParams.parse({ id: Number(req.params.id) });

  const [totals] = await db
    .select({
      totalPings: count(),
      upPings: sql<number>`count(*) filter (where ${pingsTable.status} = 'up')`,
      avgResponseTimeMs: sql<number>`avg(${pingsTable.responseTimeMs}) filter (where ${pingsTable.status} = 'up')`,
    })
    .from(pingsTable)
    .where(eq(pingsTable.monitorId, id));

  const now = Date.now();
  const cutoff24h = new Date(now - 24 * 60 * 60 * 1000);
  const cutoff7d  = new Date(now - 7  * 24 * 60 * 60 * 1000);
  const cutoff30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [totals24h] = await db
    .select({ total: count(), up: sql<number>`count(*) filter (where ${pingsTable.status} = 'up')` })
    .from(pingsTable)
    .where(and(eq(pingsTable.monitorId, id), gte(pingsTable.createdAt, cutoff24h)));

  const [totals7d] = await db
    .select({ total: count(), up: sql<number>`count(*) filter (where ${pingsTable.status} = 'up')` })
    .from(pingsTable)
    .where(and(eq(pingsTable.monitorId, id), gte(pingsTable.createdAt, cutoff7d)));

  const [totals30d] = await db
    .select({ total: count(), up: sql<number>`count(*) filter (where ${pingsTable.status} = 'up')` })
    .from(pingsTable)
    .where(and(eq(pingsTable.monitorId, id), gte(pingsTable.createdAt, cutoff30d)));

  // Count incidents (down→up transitions) per window using raw SQL
  const incidentQuery = await db.execute(sql`
    WITH ordered AS (
      SELECT status, created_at,
        LAG(status) OVER (ORDER BY created_at) AS prev_status
      FROM pings WHERE monitor_id = ${id}
    )
    SELECT
      COUNT(*) FILTER (WHERE status = 'down' AND (prev_status = 'up' OR prev_status IS NULL) AND created_at >= ${cutoff24h}) AS inc_24h,
      COUNT(*) FILTER (WHERE status = 'down' AND (prev_status = 'up' OR prev_status IS NULL) AND created_at >= ${cutoff7d})  AS inc_7d,
      COUNT(*) FILTER (WHERE status = 'down' AND (prev_status = 'up' OR prev_status IS NULL) AND created_at >= ${cutoff30d}) AS inc_30d
    FROM ordered
  `);
  const inc = (incidentQuery.rows?.[0] ?? {}) as Record<string, unknown>;

  const totalPings = Number(totals?.totalPings ?? 0);
  const upPings = Number(totals?.upPings ?? 0);
  const downPings = totalPings - upPings;
  const uptimePercent = totalPings > 0 ? (upPings / totalPings) * 100 : 100;

  const t24 = Number(totals24h?.total ?? 0); const u24 = Number(totals24h?.up ?? 0);
  const t7  = Number(totals7d?.total  ?? 0); const u7  = Number(totals7d?.up  ?? 0);
  const t30 = Number(totals30d?.total ?? 0); const u30 = Number(totals30d?.up ?? 0);

  res.json({
    monitorId: id,
    uptimePercent,
    avgResponseTimeMs: totals?.avgResponseTimeMs ? Number(totals.avgResponseTimeMs) : null,
    totalPings,
    upPings,
    downPings,
    last24hUptimePercent: t24 > 0 ? (u24 / t24) * 100 : 100,
    last7dUptimePercent:  t7  > 0 ? (u7  / t7)  * 100 : 100,
    last30dUptimePercent: t30 > 0 ? (u30 / t30) * 100 : 100,
    incidentCount24h: Number(inc.inc_24h ?? 0),
    incidentCount7d:  Number(inc.inc_7d  ?? 0),
    incidentCount30d: Number(inc.inc_30d ?? 0),
  });
});

router.post("/monitors/:id/ping", requireAuth, async (req, res) => {
  const { id } = TriggerPingParams.parse({ id: Number(req.params.id) });
  const [monitor] = await db
    .select()
    .from(monitorsTable)
    .where(and(eq(monitorsTable.id, id), eq(monitorsTable.userId, req.session.userId!)));
  if (!monitor) {
    res.status(404).json({ error: "Monitor not found" });
    return;
  }
  const result = await pingUrl(monitor.url);
  const [ping] = await db
    .insert(pingsTable)
    .values({
      monitorId: id,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.statusCode,
      error: result.error,
    })
    .returning();

  const wasUp = monitor.lastStatus !== "down";
  await db
    .update(monitorsTable)
    .set({
      lastPingedAt: new Date(),
      lastStatus: result.status,
      lastResponseTimeMs: result.responseTimeMs,
    })
    .where(eq(monitorsTable.id, id));

  if (result.status === "down" && wasUp && monitor.userId) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, monitor.userId));
    if (user?.notificationsEnabled) {
      const emailTo = user.notificationEmail ?? user.email;
      await sendDownAlert({ toEmail: emailTo, toName: user.name, monitorName: monitor.name, monitorUrl: monitor.url, error: result.error });
      if (user.telegramChatId) {
        sendTelegramMessage(user.telegramChatId, buildDownMessage(monitor.name, monitor.url, result.error)).catch(() => {});
      }
      if (user.whatsappPhone) {
        sendWhatsAppMessage(user.whatsappPhone, buildDownMessagePlain(monitor.name, monitor.url, result.error)).catch(() => {});
      }
      if (user.discordWebhookUrl) {
        sendDiscordAlert(user.discordWebhookUrl, "down", monitor.name, monitor.url, { error: result.error, statusCode: result.statusCode }).catch(() => {});
      }
    }
  }

  res.json(ping);
});

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const monitors = await db
    .select()
    .from(monitorsTable)
    .where(eq(monitorsTable.userId, req.session.userId!));
  const totalMonitors = monitors.length;
  const activeMonitors = monitors.filter((m) => m.active).length;
  const monitorsUp = monitors.filter((m) => m.lastStatus === "up").length;
  const monitorsDown = monitors.filter((m) => m.lastStatus === "down").length;
  const monitorsUnknown = monitors.filter((m) => m.lastStatus === "unknown").length;

  const monitorIds = monitors.map((m) => m.id);
  let overallUptimePercent = 100;

  if (monitorIds.length > 0) {
    const [pingTotals] = await db
      .select({
        total: count(),
        up: sql<number>`count(*) filter (where ${pingsTable.status} = 'up')`,
      })
      .from(pingsTable)
      .where(sql`${pingsTable.monitorId} = ANY(${sql.raw(`ARRAY[${monitorIds.join(",")}]::int[]`)})`);
    const total = Number(pingTotals?.total ?? 0);
    const up = Number(pingTotals?.up ?? 0);
    overallUptimePercent = total > 0 ? (up / total) * 100 : 100;
  }

  res.json({
    totalMonitors,
    activeMonitors,
    monitorsUp,
    monitorsDown,
    monitorsUnknown,
    overallUptimePercent,
  });
});

export default router;
