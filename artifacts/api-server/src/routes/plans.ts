import { Router } from "express";
import { db, plansTable } from "@workspace/db";
import type { Plan } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { PLATFORM_MIN_SECONDS } from "../lib/plan-enforcement";

const router = Router();

/** Public shape — everything the pricing page needs, nothing internal. */
function publicPlan(p: Plan) {
  return {
    slug: p.slug,
    name: p.name,
    description: p.description,
    priceUsd: Number(p.priceUsd),
    currency: p.currency,
    billingInterval: p.billingInterval,
    durationDays: p.durationDays,
    monitorLimit: p.monitorLimit,
    checkIntervalSeconds: Math.max(p.checkIntervalSeconds, PLATFORM_MIN_SECONDS),
    retentionDays: p.retentionDays,
    statusPageLimit: p.statusPageLimit,
    teamMemberLimit: p.teamMemberLimit,
    features: {
      emailAlerts: p.emailAlerts,
      webhookAlerts: p.webhookAlerts,
      telegramAlerts: p.telegramAlerts,
      sslMonitoring: p.sslMonitoring,
    },
    isFree: p.isFree,
    isUnlimited: p.isUnlimited,
    isPopular: p.isPopular,
    sortOrder: p.sortOrder,
  };
}

router.get("/plans", async (_req, res) => {
  const rows = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.isActive, true))
    .orderBy(asc(plansTable.sortOrder));
  res.json(rows.map(publicPlan));
});

router.get("/plans/:slug", async (req, res) => {
  const [row] = await db.select().from(plansTable).where(eq(plansTable.slug, req.params.slug));
  if (!row || !row.isActive) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json(publicPlan(row));
});

export default router;
