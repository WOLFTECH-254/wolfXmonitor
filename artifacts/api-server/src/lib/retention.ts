import { db, pingsTable, monitorsTable, usersTable, plansTable } from "@workspace/db";
import { and, lt, inArray, sql } from "drizzle-orm";
import { logger } from "./logger";
import { SAFE_FALLBACK_PLAN, FREE_PLAN_SLUG } from "./plans";

/**
 * Delete ping rows older than each user's plan retention window. Batched by
 * retention value (not per-user) so a handful of DELETEs cover everyone.
 * Only ping history is removed — monitors and their config are never touched.
 */
export async function runRetention(): Promise<{ deleted: number }> {
  const plans = await db.select().from(plansTable);
  const bySlug = new Map(plans.map((p) => [p.slug, p]));
  const freeRetention = bySlug.get(FREE_PLAN_SLUG)?.retentionDays ?? SAFE_FALLBACK_PLAN.retentionDays;

  const users = await db
    .select({ id: usersTable.id, planSlug: usersTable.planSlug })
    .from(usersTable);

  // group userId -> retentionDays
  const groups = new Map<number, number[]>(); // retentionDays -> userIds
  for (const u of users) {
    const days = (u.planSlug && bySlug.get(u.planSlug)?.retentionDays) || freeRetention;
    if (!groups.has(days)) groups.set(days, []);
    groups.get(days)!.push(u.id);
  }

  let deleted = 0;
  for (const [days, userIds] of groups) {
    if (userIds.length === 0) continue;
    const cutoff = new Date(Date.now() - days * 86_400_000);
    // monitor ids owned by these users
    const monitors = await db
      .select({ id: monitorsTable.id })
      .from(monitorsTable)
      .where(inArray(monitorsTable.userId, userIds));
    const monitorIds = monitors.map((m) => m.id);
    if (monitorIds.length === 0) continue;

    const res = await db
      .delete(pingsTable)
      .where(and(inArray(pingsTable.monitorId, monitorIds), lt(pingsTable.createdAt, cutoff)));
    deleted += res.rowCount ?? 0;
  }

  // Orphan pings (monitor deleted but FK cascade somehow missed) — belt & braces
  await db.execute(sql`DELETE FROM pings WHERE monitor_id NOT IN (SELECT id FROM monitors)`);

  if (deleted > 0) logger.info({ deleted }, "Retention cleanup removed old ping rows");
  return { deleted };
}
