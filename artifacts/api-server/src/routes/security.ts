import { Router } from "express";
import { db } from "@workspace/db";
import { securityEventsTable, blockedIpsTable } from "@workspace/db";
import { desc, eq, lt } from "drizzle-orm";
import { requireAdmin } from "../middlewares/admin";
import { invalidateIpCache } from "../middlewares/ip-block";

const router = Router();

router.get("/admin/security/events", requireAdmin, async (_req, res) => {
  const events = await db
    .select()
    .from(securityEventsTable)
    .orderBy(desc(securityEventsTable.createdAt))
    .limit(200);
  res.json(events);
});

router.patch("/admin/security/events/:id/resolve", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db
    .update(securityEventsTable)
    .set({ resolved: true })
    .where(eq(securityEventsTable.id, id));
  res.json({ ok: true });
});

/** Mark every event resolved. */
router.post("/admin/security/events/resolve-all", requireAdmin, async (_req, res) => {
  await db.update(securityEventsTable).set({ resolved: true });
  res.json({ ok: true });
});

/**
 * Bulk delete. `?scope=resolved` (default) clears resolved events;
 * `?scope=all` clears everything; `?olderThanDays=N` clears events older than N days.
 */
router.delete("/admin/security/events", requireAdmin, async (req, res) => {
  const scope = String(req.query.scope ?? "resolved");
  const olderThanDays = Number(req.query.olderThanDays);

  if (Number.isFinite(olderThanDays) && olderThanDays > 0) {
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    const r = await db.delete(securityEventsTable).where(lt(securityEventsTable.createdAt, cutoff));
    res.json({ ok: true, deleted: r.rowCount ?? null });
    return;
  }

  if (scope === "all") {
    const r = await db.delete(securityEventsTable);
    res.json({ ok: true, deleted: r.rowCount ?? null });
    return;
  }

  const r = await db.delete(securityEventsTable).where(eq(securityEventsTable.resolved, true));
  res.json({ ok: true, deleted: r.rowCount ?? null });
});

router.get("/admin/security/blocked-ips", requireAdmin, async (_req, res) => {
  const ips = await db
    .select()
    .from(blockedIpsTable)
    .orderBy(desc(blockedIpsTable.createdAt));
  res.json(ips);
});

router.post("/admin/security/block-ip", requireAdmin, async (req, res) => {
  const { ip, reason } = req.body as { ip?: string; reason?: string };
  if (!ip) { res.status(400).json({ error: "IP is required" }); return; }
  await db
    .insert(blockedIpsTable)
    .values({ ip: ip.trim(), reason: reason?.trim() ?? "Manually blocked by admin", blockedBy: req.session.userId })
    .onConflictDoUpdate({ target: blockedIpsTable.ip, set: { reason: reason?.trim() ?? "Manually blocked by admin", blockedBy: req.session.userId } });
  invalidateIpCache();
  res.json({ ok: true });
});

router.delete("/admin/security/blocked-ips/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(blockedIpsTable).where(eq(blockedIpsTable.id, id));
  invalidateIpCache();
  res.json({ ok: true });
});

router.get("/admin/security/stats", requireAdmin, async (_req, res) => {
  const events = await db.select().from(securityEventsTable);
  const blocked = await db.select().from(blockedIpsTable);
  const unresolved = events.filter((e) => !e.resolved).length;
  const byType = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});
  res.json({ total: events.length, unresolved, blocked: blocked.length, byType });
});

export default router;
