import { Router } from "express";
import { db, monitorsTable, pingsTable, usersTable } from "@workspace/db";
import { desc, count, eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/admin";
import { scheduleMonitor, unscheduleMonitor } from "../lib/scheduler";

const router = Router();
router.use(requireAdmin);

router.get("/admin/stats", async (_req, res) => {
  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [monitorCount] = await db.select({ count: count() }).from(monitorsTable);
  const [pingCount] = await db.select({ count: count() }).from(pingsTable);

  const monitors = await db.select({ lastStatus: monitorsTable.lastStatus }).from(monitorsTable);
  const up = monitors.filter((m) => m.lastStatus === "up").length;
  const down = monitors.filter((m) => m.lastStatus === "down").length;
  const unknown = monitors.filter((m) => m.lastStatus === "unknown").length;

  const [pingTotals] = await db.select({
    total: count(),
    upCount: sql<number>`count(*) filter (where ${pingsTable.status} = 'up')`,
  }).from(pingsTable);

  const total = Number(pingTotals?.total ?? 0);
  const upPings = Number(pingTotals?.upCount ?? 0);
  const globalUptime = total > 0 ? (upPings / total) * 100 : 100;

  res.json({
    totalUsers: Number(userCount?.count ?? 0),
    totalMonitors: Number(monitorCount?.count ?? 0),
    totalPings: Number(pingCount?.count ?? 0),
    monitorsUp: up,
    monitorsDown: down,
    monitorsUnknown: unknown,
    globalUptime,
  });
});

router.get("/admin/users", async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const monitorCounts = await db
    .select({ userId: monitorsTable.userId, count: count() })
    .from(monitorsTable)
    .groupBy(monitorsTable.userId);

  const countMap = new Map(monitorCounts.map((r) => [r.userId, Number(r.count)]));

  const result = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.isAdmin,
    notificationsEnabled: u.notificationsEnabled,
    monitorCount: countMap.get(u.id) ?? 0,
    createdAt: u.createdAt,
  }));

  res.json(result);
});

router.get("/admin/monitors", async (_req, res) => {
  const monitors = await db
    .select({
      id: monitorsTable.id,
      name: monitorsTable.name,
      url: monitorsTable.url,
      intervalMinutes: monitorsTable.intervalMinutes,
      active: monitorsTable.active,
      lastStatus: monitorsTable.lastStatus,
      lastPingedAt: monitorsTable.lastPingedAt,
      lastResponseTimeMs: monitorsTable.lastResponseTimeMs,
      createdAt: monitorsTable.createdAt,
      userId: monitorsTable.userId,
      userName: usersTable.name,
      userEmail: usersTable.email,
    })
    .from(monitorsTable)
    .leftJoin(usersTable, eq(monitorsTable.userId, usersTable.id))
    .orderBy(desc(monitorsTable.createdAt));

  res.json(monitors);
});

router.get("/admin/activity", async (_req, res) => {
  const activity = await db
    .select({
      id: pingsTable.id,
      status: pingsTable.status,
      responseTimeMs: pingsTable.responseTimeMs,
      statusCode: pingsTable.statusCode,
      error: pingsTable.error,
      createdAt: pingsTable.createdAt,
      monitorId: monitorsTable.id,
      monitorName: monitorsTable.name,
      monitorUrl: monitorsTable.url,
      userName: usersTable.name,
    })
    .from(pingsTable)
    .leftJoin(monitorsTable, eq(pingsTable.monitorId, monitorsTable.id))
    .leftJoin(usersTable, eq(monitorsTable.userId, usersTable.id))
    .orderBy(desc(pingsTable.createdAt))
    .limit(100);

  res.json(activity);
});

router.patch("/admin/monitors/:id/toggle", async (req, res) => {
  const id = Number(req.params.id);
  const [monitor] = await db.select().from(monitorsTable).where(eq(monitorsTable.id, id));
  if (!monitor) { res.status(404).json({ error: "Not found" }); return; }
  const newActive = !monitor.active;
  const [updated] = await db
    .update(monitorsTable)
    .set({ active: newActive })
    .where(eq(monitorsTable.id, id))
    .returning();
  if (newActive) scheduleMonitor(id, monitor.url, monitor.intervalMinutes);
  else unscheduleMonitor(id);
  res.json(updated);
});

router.delete("/admin/monitors/:id", async (req, res) => {
  const id = Number(req.params.id);
  unscheduleMonitor(id);
  await db.delete(monitorsTable).where(eq(monitorsTable.id, id));
  res.status(204).send();
});

router.patch("/admin/users/:id/toggle-admin", async (req, res) => {
  const id = Number(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db
    .update(usersTable)
    .set({ isAdmin: !user.isAdmin })
    .where(eq(usersTable.id, id))
    .returning();
  res.json({ id: updated.id, isAdmin: updated.isAdmin });
});

router.delete("/admin/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

export default router;
