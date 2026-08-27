import { Router } from "express";
import crypto from "node:crypto";
import { db, statusPagesTable, statusPageMonitorsTable, monitorsTable, usersTable } from "@workspace/db";
import { and, eq, inArray, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { resolvePlan } from "../lib/plans";
import { assertCanCreateStatusPage, PlanError, humanizeLimit, resourceLimitReached } from "../lib/plan-enforcement";

const router = Router();

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32) || "status";
  return `${base}-${crypto.randomBytes(2).toString("hex")}`;
}

function planError(err: unknown, res: import("express").Response): boolean {
  if (err instanceof PlanError) {
    res.status(err.status).json({ error: err.message, upgrade: true, feature: err.feature });
    return true;
  }
  return false;
}

// ── Owner endpoints ────────────────────────────────────────────────────────

router.get("/me/status-pages", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const pages = await db.select().from(statusPagesTable).where(eq(statusPagesTable.userId, userId));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const plan = await resolvePlan(user);
  const withCounts = await Promise.all(
    pages.map(async (p) => {
      const [{ n }] = await db.select({ n: count() }).from(statusPageMonitorsTable).where(eq(statusPageMonitorsTable.statusPageId, p.id));
      return { ...p, monitorCount: Number(n ?? 0) };
    }),
  );
  res.json({
    pages: withCounts,
    limit: plan.statusPageLimit,
    limitLabel: humanizeLimit(plan.statusPageLimit),
    canCreate: plan.statusPageLimit !== 0 && !resourceLimitReached(plan.statusPageLimit, pages.length),
  });
});

router.post("/me/status-pages", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { name, description, isPublic, monitorIds } = req.body as {
    name?: string; description?: string; isPublic?: boolean; monitorIds?: number[];
  };
  if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }

  try {
    await assertCanCreateStatusPage(userId);
  } catch (err) {
    if (planError(err, res)) return;
    throw err;
  }

  const [page] = await db.insert(statusPagesTable).values({
    userId,
    slug: slugify(name),
    name: name.trim(),
    description: (description ?? "").trim(),
    isPublic: isPublic ?? true,
  }).returning();

  if (Array.isArray(monitorIds) && monitorIds.length) {
    const owned = await db.select({ id: monitorsTable.id }).from(monitorsTable)
      .where(and(eq(monitorsTable.userId, userId), inArray(monitorsTable.id, monitorIds)));
    if (owned.length) {
      await db.insert(statusPageMonitorsTable).values(owned.map((m, i) => ({ statusPageId: page.id, monitorId: m.id, sortOrder: i })));
    }
  }
  res.status(201).json(page);
});

router.patch("/me/status-pages/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = Number(req.params.id);
  const { name, description, isPublic } = req.body as { name?: string; description?: string; isPublic?: boolean };
  const set: Partial<typeof statusPagesTable.$inferInsert> = {};
  if (name?.trim()) set.name = name.trim();
  if (description !== undefined) set.description = description.trim();
  if (typeof isPublic === "boolean") set.isPublic = isPublic;

  const [updated] = await db.update(statusPagesTable).set(set)
    .where(and(eq(statusPagesTable.id, id), eq(statusPagesTable.userId, userId))).returning();
  if (!updated) { res.status(404).json({ error: "Status page not found" }); return; }
  res.json(updated);
});

router.put("/me/status-pages/:id/monitors", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = Number(req.params.id);
  const { monitorIds } = req.body as { monitorIds?: number[] };

  const [page] = await db.select().from(statusPagesTable)
    .where(and(eq(statusPagesTable.id, id), eq(statusPagesTable.userId, userId)));
  if (!page) { res.status(404).json({ error: "Status page not found" }); return; }

  const ids = Array.isArray(monitorIds) ? monitorIds : [];
  const owned = ids.length
    ? await db.select({ id: monitorsTable.id }).from(monitorsTable)
        .where(and(eq(monitorsTable.userId, userId), inArray(monitorsTable.id, ids)))
    : [];

  await db.delete(statusPageMonitorsTable).where(eq(statusPageMonitorsTable.statusPageId, id));
  if (owned.length) {
    await db.insert(statusPageMonitorsTable).values(owned.map((m, i) => ({ statusPageId: id, monitorId: m.id, sortOrder: i })));
  }
  res.json({ ok: true, count: owned.length });
});

router.delete("/me/status-pages/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = Number(req.params.id);
  const [existing] = await db.select().from(statusPagesTable)
    .where(and(eq(statusPagesTable.id, id), eq(statusPagesTable.userId, userId)));
  if (!existing) { res.status(404).json({ error: "Status page not found" }); return; }
  await db.delete(statusPagesTable).where(eq(statusPagesTable.id, id));
  res.status(204).send();
});

// ── Public view ────────────────────────────────────────────────────────────

router.get("/status-pages/:slug", async (req, res) => {
  const [page] = await db.select().from(statusPagesTable).where(eq(statusPagesTable.slug, req.params.slug));
  if (!page || !page.isPublic) { res.status(404).json({ error: "Status page not found" }); return; }

  const links = await db.select().from(statusPageMonitorsTable)
    .where(eq(statusPageMonitorsTable.statusPageId, page.id));
  const ids = links.map((l) => l.monitorId);
  const monitors = ids.length
    ? await db.select({
        id: monitorsTable.id, name: monitorsTable.name, url: monitorsTable.url,
        lastStatus: monitorsTable.lastStatus, lastPingedAt: monitorsTable.lastPingedAt,
        lastResponseTimeMs: monitorsTable.lastResponseTimeMs,
      }).from(monitorsTable).where(inArray(monitorsTable.id, ids))
    : [];

  const up = monitors.filter((m) => m.lastStatus === "up").length;
  const down = monitors.filter((m) => m.lastStatus === "down").length;
  res.json({
    name: page.name, description: page.description,
    monitors, total: monitors.length, up, down,
  });
});

export default router;
