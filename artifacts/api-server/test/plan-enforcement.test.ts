import { test } from "node:test";
import assert from "node:assert/strict";

// The pool in @workspace/db is constructed lazily, so a throwaway URL lets the
// module graph import without a live database. No query is executed here.
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";

import {
  isUnlimited,
  resourceLimitReached,
  monitorLimitReached,
  featureEnabled,
  validateInterval,
  humanizeLimit,
  humanizeInterval,
  planEntitlements,
  PLATFORM_MIN_SECONDS,
} from "../src/lib/plan-enforcement.ts";
import type { Plan } from "@workspace/db";

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 1,
    slug: "test",
    name: "Test",
    description: "",
    priceUsd: "0",
    currency: "USD",
    billingInterval: "monthly",
    durationDays: 30,
    monitorLimit: 3,
    checkIntervalSeconds: 300,
    retentionDays: 7,
    statusPageLimit: 0,
    teamMemberLimit: 1,
    emailAlerts: true,
    webhookAlerts: false,
    telegramAlerts: false,
    sslMonitoring: false,
    isActive: true,
    isFree: true,
    isUnlimited: false,
    isPopular: false,
    sortOrder: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

test("isUnlimited: negative limits are unlimited, zero and positive are not", () => {
  assert.equal(isUnlimited(-1), true);
  assert.equal(isUnlimited(0), false);
  assert.equal(isUnlimited(3), false);
});

test("resourceLimitReached: honours the cap and treats -1 as no cap", () => {
  assert.equal(resourceLimitReached(3, 2), false);
  assert.equal(resourceLimitReached(3, 3), true);
  assert.equal(resourceLimitReached(3, 4), true);
  assert.equal(resourceLimitReached(-1, 9_999), false);
});

test("monitor quota per plan (Free 3 / Starter 10 / Pro 30 / Business 100 / Unlimited ∞)", () => {
  const cases: Array<[number, number, boolean]> = [
    [3, 2, false], [3, 3, true],
    [10, 9, false], [10, 10, true],
    [30, 29, false], [30, 30, true],
    [100, 99, false], [100, 100, true],
    [-1, 100_000, false],
  ];
  for (const [limit, count, reached] of cases) {
    assert.equal(
      monitorLimitReached(makePlan({ monitorLimit: limit }), count),
      reached,
      `limit=${limit} count=${count}`,
    );
  }
});

test("featureEnabled: gates each channel off its plan flag", () => {
  const pro = makePlan({ emailAlerts: true, webhookAlerts: true, telegramAlerts: true, sslMonitoring: true });
  const free = makePlan({ emailAlerts: true, webhookAlerts: false, telegramAlerts: false, sslMonitoring: false });

  assert.equal(featureEnabled(pro, "telegram"), true);
  assert.equal(featureEnabled(pro, "ssl"), true);
  assert.equal(featureEnabled(free, "telegram"), false);
  assert.equal(featureEnabled(free, "webhook"), false);
  assert.equal(featureEnabled(free, "ssl"), false);
  assert.equal(featureEnabled(free, "email"), true);
});

test("validateInterval: rejects requests faster than the plan minimum", () => {
  const pro = makePlan({ checkIntervalSeconds: 60 });
  const tooFast = validateInterval(pro, 30);
  assert.equal(tooFast.ok, false);
  if (!tooFast.ok) assert.equal(tooFast.min, 60);

  const ok = validateInterval(pro, 60);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.seconds, 60);

  const slower = validateInterval(pro, 300);
  assert.equal(slower.ok, true);
});

test("validateInterval: platform floor applies even to Unlimited (15s plan)", () => {
  const unlimited = makePlan({ checkIntervalSeconds: 15, monitorLimit: -1, isUnlimited: true });
  // Plan says 15s, but PLATFORM_MIN_SECONDS (10) is still the hard floor and 15 > 10.
  const at15 = validateInterval(unlimited, 15);
  assert.equal(at15.ok, true);

  const at5 = validateInterval(unlimited, 5);
  assert.equal(at5.ok, false);
  if (!at5.ok) assert.equal(at5.min, Math.max(15, PLATFORM_MIN_SECONDS));
});

test("validateInterval: non-positive / non-finite requests are rejected", () => {
  const p = makePlan({ checkIntervalSeconds: 60 });
  assert.equal(validateInterval(p, 0).ok, false);
  assert.equal(validateInterval(p, -10).ok, false);
  assert.equal(validateInterval(p, Number.NaN).ok, false);
  assert.equal(validateInterval(p, Number.POSITIVE_INFINITY).ok, false);
});

test("humanize helpers render '-1' as 'Unlimited', never the raw number", () => {
  assert.equal(humanizeLimit(-1), "Unlimited");
  assert.equal(humanizeLimit(3), "3");
  assert.equal(humanizeInterval(30), "every 30 seconds");
  assert.equal(humanizeInterval(60), "every 1 minute");
  assert.equal(humanizeInterval(120), "every 2 minutes");
});

test("planEntitlements: client-safe subset, interval clamped to the platform floor", () => {
  const ent = planEntitlements(makePlan({ checkIntervalSeconds: 5, monitorLimit: -1, isUnlimited: true }));
  assert.equal(ent.checkIntervalSeconds, PLATFORM_MIN_SECONDS);
  assert.equal(ent.monitorLimit, -1);
  assert.equal(ent.isUnlimited, true);
  assert.equal("priceUsd" in ent, false);
  assert.equal("createdAt" in ent, false);
});
