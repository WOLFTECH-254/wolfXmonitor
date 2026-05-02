import { Router } from "express";
import { db } from "@workspace/db";
import { securityEventsTable, blockedIpsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
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
