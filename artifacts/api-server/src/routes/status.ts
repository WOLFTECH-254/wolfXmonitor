import { Router } from "express";
import { db, monitorsTable, pingsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/status", async (_req, res) => {
  const monitors = await db
    .select({
      id: monitorsTable.id,
      name: monitorsTable.name,
      url: monitorsTable.url,
      lastStatus: monitorsTable.lastStatus,
      lastPingedAt: monitorsTable.lastPingedAt,
      lastResponseTimeMs: monitorsTable.lastResponseTimeMs,
      intervalMinutes: monitorsTable.intervalMinutes,
      createdAt: monitorsTable.createdAt,
    })
    .from(monitorsTable)
    .where(eq(monitorsTable.active, true))
    .orderBy(desc(monitorsTable.createdAt));

  const up = monitors.filter((m) => m.lastStatus === "up").length;
  const down = monitors.filter((m) => m.lastStatus === "down").length;

  res.json({ monitors, up, down, total: monitors.length });
});

router.get("/status/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [monitor] = await db
    .select({
      id: monitorsTable.id,
      name: monitorsTable.name,
      url: monitorsTable.url,
      lastStatus: monitorsTable.lastStatus,
      lastPingedAt: monitorsTable.lastPingedAt,
      lastResponseTimeMs: monitorsTable.lastResponseTimeMs,
      intervalMinutes: monitorsTable.intervalMinutes,
      createdAt: monitorsTable.createdAt,
      userName: usersTable.name,
    })
    .from(monitorsTable)
    .leftJoin(usersTable, eq(monitorsTable.userId, usersTable.id))
    .where(eq(monitorsTable.id, id));

  if (!monitor) { res.status(404).json({ error: "Monitor not found" }); return; }

  const pings = await db
    .select()
    .from(pingsTable)
    .where(eq(pingsTable.monitorId, id))
    .orderBy(desc(pingsTable.createdAt))
    .limit(90);

  const upCount = pings.filter((p) => p.status === "up").length;
  const uptime = pings.length > 0 ? (upCount / pings.length) * 100 : null;

  res.json({ monitor, pings, uptime });
});

export default router;
