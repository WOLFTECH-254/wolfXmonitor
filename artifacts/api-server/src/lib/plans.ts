import { db, plansTable, usersTable } from "@workspace/db";
import type { Plan } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";

export const FREE_PLAN_SLUG = "free";

/**
 * Reference rate used only to seed default USD prices from the KSh spec.
 * priceUsd is the canonical column; admins can set it precisely afterwards.
 */
const KES_PER_USD = 129.44;
const usd = (kes: number) => Number((kes / KES_PER_USD).toFixed(2));

type SeedPlan = Omit<typeof plansTable.$inferInsert, "id" | "createdAt" | "updatedAt" | "priceUsd"> & { priceKes: number };

/** INITIAL defaults. Inserted once per slug; never overwrites later edits. */
export const PLAN_SEED: SeedPlan[] = [
  {
    slug: "free", name: "Free", description: "Get started with basic monitoring.",
    priceKes: 0, currency: "USD", billingInterval: "monthly", durationDays: 30,
    monitorLimit: 3, checkIntervalSeconds: 300, retentionDays: 7,
    statusPageLimit: 0, teamMemberLimit: 1,
    emailAlerts: true, webhookAlerts: false, telegramAlerts: false, sslMonitoring: false,
    isActive: true, isFree: true, isUnlimited: false, isPopular: false, sortOrder: 1,
  },
  {
    slug: "starter", name: "Starter", description: "For side projects and small sites.",
    priceKes: 99, currency: "USD", billingInterval: "monthly", durationDays: 30,
    monitorLimit: 10, checkIntervalSeconds: 120, retentionDays: 30,
    statusPageLimit: 1, teamMemberLimit: 1,
    emailAlerts: true, webhookAlerts: true, telegramAlerts: false, sslMonitoring: true,
    isActive: true, isFree: false, isUnlimited: false, isPopular: false, sortOrder: 2,
  },
  {
    slug: "pro", name: "Pro", description: "For growing teams that need fast checks.",
    priceKes: 249, currency: "USD", billingInterval: "monthly", durationDays: 30,
    monitorLimit: 30, checkIntervalSeconds: 60, retentionDays: 90,
    statusPageLimit: 3, teamMemberLimit: 3,
    emailAlerts: true, webhookAlerts: true, telegramAlerts: true, sslMonitoring: true,
    isActive: true, isFree: false, isUnlimited: false, isPopular: true, sortOrder: 3,
  },
  {
    slug: "business", name: "Business", description: "High-volume monitoring with 30s checks.",
    priceKes: 599, currency: "USD", billingInterval: "monthly", durationDays: 30,
    monitorLimit: 100, checkIntervalSeconds: 30, retentionDays: 180,
    statusPageLimit: 10, teamMemberLimit: 10,
    emailAlerts: true, webhookAlerts: true, telegramAlerts: true, sslMonitoring: true,
    isActive: true, isFree: false, isUnlimited: false, isPopular: false, sortOrder: 4,
  },
  {
    slug: "unlimited", name: "Unlimited", description: "No limits. 15-second checks.",
    priceKes: 999, currency: "USD", billingInterval: "monthly", durationDays: 30,
    monitorLimit: -1, checkIntervalSeconds: 15, retentionDays: 365,
    statusPageLimit: -1, teamMemberLimit: -1,
    emailAlerts: true, webhookAlerts: true, telegramAlerts: true, sslMonitoring: true,
    isActive: true, isFree: false, isUnlimited: true, isPopular: false, sortOrder: 5,
  },
];

/** Hard fallback when the plans table is empty / a slug can't be resolved. */
export const SAFE_FALLBACK_PLAN: Plan = {
  id: -1,
  slug: "free", name: "Free", description: "",
  priceUsd: "0", currency: "USD", billingInterval: "monthly", durationDays: 30,
  monitorLimit: 3, checkIntervalSeconds: 300, retentionDays: 7,
  statusPageLimit: 0, teamMemberLimit: 1,
  emailAlerts: true, webhookAlerts: false, telegramAlerts: false, sslMonitoring: false,
  isActive: true, isFree: true, isUnlimited: false, isPopular: false, sortOrder: 1,
  createdAt: new Date(0), updatedAt: new Date(0),
};

/** Insert any missing seed plans. Idempotent — existing rows are left alone. */
export async function seedPlans(): Promise<void> {
  const existing = await db.select({ slug: plansTable.slug }).from(plansTable);
  const have = new Set(existing.map((r) => r.slug));
  const missing = PLAN_SEED.filter((p) => !have.has(p.slug));
  if (missing.length === 0) return;
  for (const { priceKes, ...rest } of missing) {
    await db.insert(plansTable).values({ ...rest, priceUsd: String(usd(priceKes)) }).onConflictDoNothing();
  }
  logger.info({ inserted: missing.map((p) => p.slug) }, "Seeded default plans");
}

/** Point any user without a valid plan at the Free plan. Safe + idempotent. */
export async function migrateExistingUsers(): Promise<void> {
  const validSlugs = new Set(
    (await db.select({ slug: plansTable.slug }).from(plansTable)).map((r) => r.slug),
  );
  if (validSlugs.size === 0) return;

  const rows = await db
    .select({ id: usersTable.id, planSlug: usersTable.planSlug })
    .from(usersTable);
  const toFix = rows.filter((u) => !u.planSlug || !validSlugs.has(u.planSlug)).map((u) => u.id);
  if (toFix.length === 0) return;

  await db
    .update(usersTable)
    .set({ planSlug: FREE_PLAN_SLUG, plan: "free", subscriptionStatus: "active" })
    .where(inArray(usersTable.id, toFix));
  logger.info({ count: toFix.length }, "Assigned Free plan to users without a valid plan");
}

const planCache = new Map<string, { plan: Plan; at: number }>();
const CACHE_MS = 30_000;

export async function getPlanBySlug(slug: string | null | undefined): Promise<Plan | null> {
  if (!slug) return null;
  const hit = planCache.get(slug);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.plan;
  const [row] = await db.select().from(plansTable).where(eq(plansTable.slug, slug));
  if (row) planCache.set(slug, { plan: row, at: Date.now() });
  return row ?? null;
}

export function invalidatePlanCache(): void {
  planCache.clear();
}

/** Resolve the effective plan for a user, always returning a usable plan. */
export async function resolvePlan(user: { planSlug?: string | null } | null | undefined): Promise<Plan> {
  return (
    (await getPlanBySlug(user?.planSlug)) ??
    (await getPlanBySlug(FREE_PLAN_SLUG)) ??
    SAFE_FALLBACK_PLAN
  );
}

export async function resolvePlanByUserId(userId: number): Promise<Plan> {
  const [u] = await db.select({ planSlug: usersTable.planSlug }).from(usersTable).where(eq(usersTable.id, userId));
  return resolvePlan(u);
}
