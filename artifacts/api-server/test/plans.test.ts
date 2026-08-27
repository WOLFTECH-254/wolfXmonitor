import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";

import { PLAN_SEED, SAFE_FALLBACK_PLAN, FREE_PLAN_SLUG } from "../src/lib/plans.ts";

const bySlug = (slug: string) => {
  const p = PLAN_SEED.find((x) => x.slug === slug);
  assert.ok(p, `seed plan '${slug}' exists`);
  return p!;
};

test("seed: five plans, unique slugs, ascending sortOrder", () => {
  assert.equal(PLAN_SEED.length, 5);
  const slugs = PLAN_SEED.map((p) => p.slug);
  assert.deepEqual([...new Set(slugs)].sort(), [...slugs].sort());
  const orders = PLAN_SEED.map((p) => p.sortOrder);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
});

test("seed: Free plan defaults match the spec", () => {
  const free = bySlug("free");
  assert.equal(free.priceKes, 0);
  assert.equal(free.monitorLimit, 3);
  assert.equal(free.checkIntervalSeconds, 300);
  assert.equal(free.retentionDays, 7);
  assert.equal(free.statusPageLimit, 0);
  assert.equal(free.teamMemberLimit, 1);
  assert.equal(free.emailAlerts, true);
  assert.equal(free.webhookAlerts, false);
  assert.equal(free.telegramAlerts, false);
  assert.equal(free.sslMonitoring, false);
  assert.equal(free.isFree, true);
});

test("seed: paid tiers scale limits and unlock features monotonically", () => {
  assert.equal(bySlug("starter").monitorLimit, 10);
  assert.equal(bySlug("starter").checkIntervalSeconds, 120);
  assert.equal(bySlug("starter").webhookAlerts, true);
  assert.equal(bySlug("starter").sslMonitoring, true);
  assert.equal(bySlug("starter").telegramAlerts, false);

  assert.equal(bySlug("pro").monitorLimit, 30);
  assert.equal(bySlug("pro").checkIntervalSeconds, 60);
  assert.equal(bySlug("pro").telegramAlerts, true);
  assert.equal(bySlug("pro").isPopular, true);

  assert.equal(bySlug("business").monitorLimit, 100);
  assert.equal(bySlug("business").checkIntervalSeconds, 30);
  assert.equal(bySlug("business").retentionDays, 180);
});

test("seed: Unlimited tier is unbounded and marked", () => {
  const u = bySlug("unlimited");
  assert.equal(u.monitorLimit, -1);
  assert.equal(u.statusPageLimit, -1);
  assert.equal(u.teamMemberLimit, -1);
  assert.equal(u.checkIntervalSeconds, 15);
  assert.equal(u.retentionDays, 365);
  assert.equal(u.isUnlimited, true);
});

test("only one seed plan is the free plan, and its slug is the resolver constant", () => {
  const frees = PLAN_SEED.filter((p) => p.isFree);
  assert.equal(frees.length, 1);
  assert.equal(frees[0].slug, FREE_PLAN_SLUG);
});

test("SAFE_FALLBACK_PLAN mirrors the Free plan's limits (used when the table is empty)", () => {
  assert.equal(SAFE_FALLBACK_PLAN.slug, FREE_PLAN_SLUG);
  assert.equal(SAFE_FALLBACK_PLAN.monitorLimit, 3);
  assert.equal(SAFE_FALLBACK_PLAN.checkIntervalSeconds, 300);
  assert.equal(SAFE_FALLBACK_PLAN.retentionDays, 7);
  assert.equal(SAFE_FALLBACK_PLAN.statusPageLimit, 0);
  assert.equal(SAFE_FALLBACK_PLAN.isFree, true);
  assert.equal(SAFE_FALLBACK_PLAN.emailAlerts, true);
  assert.equal(SAFE_FALLBACK_PLAN.telegramAlerts, false);
});
