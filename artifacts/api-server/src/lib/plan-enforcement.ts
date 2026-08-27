import { db, monitorsTable, usersTable, statusPagesTable, teamsTable, teamMembersTable } from "@workspace/db";
import type { Plan } from "@workspace/db";
import { and, count, eq } from "drizzle-orm";
import { resolvePlan } from "./plans";

/**
 * Infrastructure floor applied to every plan, including "Unlimited". The
 * scheduler ticks every TICK_GRANULARITY_SECONDS, so the real minimum a check
 * can run is bounded by both.
 */
export const PLATFORM_MIN_SECONDS = 10;
export const TICK_GRANULARITY_SECONDS = 5;

export type PlanFeature = "email" | "webhook" | "telegram" | "ssl";

export class PlanError extends Error {
  status = 403;
  upgrade = true;
  feature?: string;
  constructor(message: string, feature?: string) {
    super(message);
    this.name = "PlanError";
    this.feature = feature;
  }
}

// ── Pure helpers (unit-tested) ──────────────────────────────────────────────

export const isUnlimited = (limit: number) => limit < 0;

export function resourceLimitReached(limit: number, current: number): boolean {
  if (isUnlimited(limit)) return false;
  return current >= limit;
}

export function monitorLimitReached(plan: Pick<Plan, "monitorLimit">, currentCount: number): boolean {
  return resourceLimitReached(plan.monitorLimit, currentCount);
}

export function featureEnabled(
  plan: Pick<Plan, "emailAlerts" | "webhookAlerts" | "telegramAlerts" | "sslMonitoring">,
  feature: PlanFeature,
): boolean {
  switch (feature) {
    case "email": return plan.emailAlerts;
    case "webhook": return plan.webhookAlerts;
    case "telegram": return plan.telegramAlerts;
    case "ssl": return plan.sslMonitoring;
  }
}

/**
 * Validate a requested check interval against a plan. Requests faster than the
 * plan's minimum are rejected (authoritative), not silently clamped.
 */
export function validateInterval(
  plan: Pick<Plan, "checkIntervalSeconds">,
  requestedSeconds: number,
): { ok: true; seconds: number } | { ok: false; message: string; min: number } {
  const min = Math.max(plan.checkIntervalSeconds, PLATFORM_MIN_SECONDS);
  if (!Number.isFinite(requestedSeconds) || requestedSeconds <= 0) {
    return { ok: false, message: "Check interval must be a positive number of seconds.", min };
  }
  if (requestedSeconds < min) {
    return {
      ok: false,
      min,
      message: `Your plan's fastest check interval is ${humanizeInterval(min)}. Upgrade for faster checks.`,
    };
  }
  return { ok: true, seconds: Math.round(requestedSeconds) };
}

export function humanizeLimit(n: number): string {
  return isUnlimited(n) ? "Unlimited" : String(n);
}

export function humanizeInterval(seconds: number): string {
  if (seconds < 60) return `every ${seconds} seconds`;
  const m = Math.round(seconds / 60);
  return `every ${m} minute${m === 1 ? "" : "s"}`;
}

export function humanizeRetention(days: number): string {
  if (days % 365 === 0) return `${days / 365} year${days === 365 ? "" : "s"} history`;
  if (days % 30 === 0) return `${days / 30} month${days === 30 ? "" : "s"} history`;
  return `${days} days history`;
}

/** A plain, client-safe view of a plan's entitlements. */
export function planEntitlements(plan: Plan) {
  return {
    slug: plan.slug,
    name: plan.name,
    monitorLimit: plan.monitorLimit,
    checkIntervalSeconds: Math.max(plan.checkIntervalSeconds, PLATFORM_MIN_SECONDS),
    retentionDays: plan.retentionDays,
    statusPageLimit: plan.statusPageLimit,
    teamMemberLimit: plan.teamMemberLimit,
    emailAlerts: plan.emailAlerts,
    webhookAlerts: plan.webhookAlerts,
    telegramAlerts: plan.telegramAlerts,
    sslMonitoring: plan.sslMonitoring,
    isUnlimited: plan.isUnlimited,
  };
}

// ── DB-backed guards ───────────────────────────────────────────────────────

export async function getUsage(userId: number) {
  const [[m], [sp]] = await Promise.all([
    db.select({ n: count() }).from(monitorsTable).where(eq(monitorsTable.userId, userId)),
    db.select({ n: count() }).from(statusPagesTable).where(eq(statusPagesTable.userId, userId)),
  ]);
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.ownerId, userId));
  let teamMembers = 1;
  if (team) {
    const [tm] = await db.select({ n: count() }).from(teamMembersTable).where(eq(teamMembersTable.teamId, team.id));
    teamMembers = Number(tm?.n ?? 0) + 1; // +1 for the owner
  }
  return {
    monitors: Number(m?.n ?? 0),
    statusPages: Number(sp?.n ?? 0),
    teamMembers,
  };
}

async function loadUserAndPlan(userId: number): Promise<{ user: typeof usersTable.$inferSelect; plan: Plan }> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) throw new PlanError("Account not found", undefined);
  const plan = await resolvePlan(user);
  return { user, plan };
}

export async function assertCanCreateMonitor(userId: number): Promise<Plan> {
  const { user, plan } = await loadUserAndPlan(userId);
  const [{ n }] = await db
    .select({ n: count() })
    .from(monitorsTable)
    .where(eq(monitorsTable.userId, userId));
  const current = Number(n ?? 0);

  if (user.overLimitSince) {
    throw new PlanError(
      `Your account is over the ${plan.name} plan limit. Remove monitors or upgrade to add more.`,
      "monitor_limit",
    );
  }
  if (monitorLimitReached(plan, current)) {
    throw new PlanError(
      `You've reached the ${humanizeLimit(plan.monitorLimit)}-monitor limit on the ${plan.name} plan. Upgrade your plan to add more monitors.`,
      "monitor_limit",
    );
  }
  return plan;
}

export function assertIntervalAllowed(plan: Plan, requestedSeconds: number): number {
  const r = validateInterval(plan, requestedSeconds);
  if (!r.ok) throw new PlanError(r.message, "check_interval");
  return r.seconds;
}

export function assertFeatureAllowed(plan: Plan, feature: PlanFeature): void {
  if (!featureEnabled(plan, feature)) {
    const label =
      feature === "telegram" ? "Telegram alerts"
      : feature === "webhook" ? "Webhook / Discord alerts"
      : feature === "ssl" ? "SSL certificate monitoring"
      : "Email alerts";
    throw new PlanError(`${label} are not included in the ${plan.name} plan. Upgrade to enable them.`, feature);
  }
}

export async function assertCanCreateStatusPage(userId: number): Promise<Plan> {
  const { plan } = await loadUserAndPlan(userId);
  if (plan.statusPageLimit === 0) {
    throw new PlanError(`Status pages are not included in the ${plan.name} plan. Upgrade to create one.`, "status_pages");
  }
  const [{ n }] = await db.select({ n: count() }).from(statusPagesTable).where(eq(statusPagesTable.userId, userId));
  if (resourceLimitReached(plan.statusPageLimit, Number(n ?? 0))) {
    throw new PlanError(
      `You've reached the ${humanizeLimit(plan.statusPageLimit)} status page limit on the ${plan.name} plan.`,
      "status_pages",
    );
  }
  return plan;
}

export async function assertCanAddTeamMember(userId: number, addingCount = 1): Promise<Plan> {
  const { plan } = await loadUserAndPlan(userId);
  if (plan.teamMemberLimit <= 1) {
    throw new PlanError(`The ${plan.name} plan is single-seat. Upgrade to invite team members.`, "team_members");
  }
  const usage = await getUsage(userId);
  if (resourceLimitReached(plan.teamMemberLimit, usage.teamMembers + addingCount - 1)) {
    throw new PlanError(
      `Your team is at the ${humanizeLimit(plan.teamMemberLimit)} seat limit on the ${plan.name} plan.`,
      "team_members",
    );
  }
  return plan;
}

/**
 * Recompute the over-limit flag after a plan change. Existing resources are
 * never deleted — we just gate new ones.
 */
export async function recomputeOverLimit(userId: number): Promise<boolean> {
  const { user, plan } = await loadUserAndPlan(userId);
  const usage = await getUsage(userId);
  const over = !isUnlimited(plan.monitorLimit) && usage.monitors > plan.monitorLimit;

  const currentlyOver = !!user.overLimitSince;
  if (over && !currentlyOver) {
    await db.update(usersTable).set({ overLimitSince: new Date() }).where(eq(usersTable.id, userId));
  } else if (!over && currentlyOver) {
    await db.update(usersTable).set({ overLimitSince: null }).where(eq(usersTable.id, userId));
  }
  return over;
}
