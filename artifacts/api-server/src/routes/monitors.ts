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
import { scheduleMonitor, unscheduleMonitor } from "../lib/scheduler";
import { requireAuth } from "../middlewares/auth";
import { sendDownAlert, sendWelcomeAlert, sendDeleteAlert } from "../lib/mailer";

const router = Router();

router.use(requireAuth);

router.get("/monitors", async (req, res) => {
  const monitors = await db
    .select()
    .from(monitorsTable)
    .where(eq(monitorsTable.userId, req.session.userId!))
    .orderBy(desc(monitorsTable.createdAt));
  res.json(monitors);
});

router.post("/monitors", async (req, res) => {
  const body = CreateMonitorBody.parse(req.body);
  const [monitor] = await db
    .insert(monitorsTable)
    .values({
      userId: req.session.userId!,
      name: body.name,
      url: body.url,
      intervalMinutes: body.intervalMinutes ?? 5,
      active: body.active ?? true,
    })
    .returning();
  if (monitor.active) {
    scheduleMonitor(monitor.id, monitor.url, monitor.intervalMinutes);
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (user?.notificationsEnabled) {
    const emailTo = user.notificationEmail ?? user.email;
    sendWelcomeAlert({
      toEmail: emailTo,
      toName: user.name,
      monitorName: monitor.name,
      monitorUrl: monitor.url,
      intervalMinutes: monitor.intervalMinutes,
    }).catch(() => {});
  }

  res.status(201).json(monitor);
});

router.get("/monitors/:id", async (req, res) => {
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

router.put("/monitors/:id", async (req, res) => {
  const { id } = UpdateMonitorParams.parse({ id: Number(req.params.id) });
  const body = UpdateMonitorBody.parse(req.body);
  const updates: Partial<typeof monitorsTable.$inferInsert> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.url !== undefined) updates.url = body.url;
  if (body.intervalMinutes !== undefined) updates.intervalMinutes = body.intervalMinutes;
  if (body.active !== undefined) updates.active = body.active;

  const [monitor] = await db
    .update(monitorsTable)
    .set(updates)
    .where(and(eq(monitorsTable.id, id), eq(monitorsTable.userId, req.session.userId!)))
    .returning();
  if (!monitor) {
    res.status(404).json({ error: "Monitor not found" });
    return;
  }
  if (monitor.active) {
    scheduleMonitor(monitor.id, monitor.url, monitor.intervalMinutes);
  } else {
    unscheduleMonitor(monitor.id);
  }
  res.json(monitor);
});

router.delete("/monitors/:id", async (req, res) => {
  const { id } = DeleteMonitorParams.parse({ id: Number(req.params.id) });
  const [monitor] = await db
    .select()
    .from(monitorsTable)
    .where(and(eq(monitorsTable.id, id), eq(monitorsTable.userId, req.session.userId!)));
  if (!monitor) {
    res.status(404).json({ error: "Monitor not found" });
    return;
  }
  unscheduleMonitor(id);
  await db.delete(monitorsTable).where(eq(monitorsTable.id, id));

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

router.get("/monitors/:id/pings", async (req, res) => {
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

router.get("/monitors/:id/stats", async (req, res) => {
  const { id } = GetMonitorStatsParams.parse({ id: Number(req.params.id) });

  const [totals] = await db
    .select({
      totalPings: count(),
      upPings: sql<number>`count(*) filter (where ${pingsTable.status} = 'up')`,
      avgResponseTimeMs: sql<number>`avg(${pingsTable.responseTimeMs}) filter (where ${pingsTable.status} = 'up')`,
    })
    .from(pingsTable)
    .where(eq(pingsTable.monitorId, id));

  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [totals24h] = await db
    .select({
      total: count(),
      up: sql<number>`count(*) filter (where ${pingsTable.status} = 'up')`,
    })
    .from(pingsTable)
    .where(and(eq(pingsTable.monitorId, id), gte(pingsTable.createdAt, cutoff24h)));

  const totalPings = Number(totals?.totalPings ?? 0);
  const upPings = Number(totals?.upPings ?? 0);
  const downPings = totalPings - upPings;
  const uptimePercent = totalPings > 0 ? (upPings / totalPings) * 100 : 100;
  const total24h = Number(totals24h?.total ?? 0);
  const up24h = Number(totals24h?.up ?? 0);
  const last24hUptimePercent = total24h > 0 ? (up24h / total24h) * 100 : 100;

  res.json({
    monitorId: id,
    uptimePercent,
    avgResponseTimeMs: totals?.avgResponseTimeMs ? Number(totals.avgResponseTimeMs) : null,
    totalPings,
    upPings,
    downPings,
    last24hUptimePercent,
  });
});

router.post("/monitors/:id/ping", async (req, res) => {
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
    }
  }

  res.json(ping);
});

router.get("/dashboard/summary", async (req, res) => {
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
