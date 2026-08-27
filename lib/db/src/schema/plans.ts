import { pgTable, serial, text, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";

/**
 * Subscription plans. The database is the source of truth — the app seeds
 * defaults once (idempotently) and never overwrites admin edits afterwards.
 *
 * Limit convention: -1 means "unlimited" for monitorLimit / statusPageLimit /
 * teamMemberLimit. The platform still applies an infrastructure floor on check
 * interval regardless of plan (see lib/plan-enforcement.ts PLATFORM_MIN_SECONDS).
 */
export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),

  // Pricing — priceUsd stays the canonical amount; the customer-facing page
  // converts to the viewer's currency with live FX (existing behaviour).
  priceUsd: numeric("price_usd", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  billingInterval: text("billing_interval").notNull().default("monthly"),
  durationDays: integer("duration_days").notNull().default(30),

  // Limits (-1 = unlimited)
  monitorLimit: integer("monitor_limit").notNull().default(-1),
  checkIntervalSeconds: integer("check_interval_seconds").notNull().default(300),
  retentionDays: integer("retention_days").notNull().default(7),
  statusPageLimit: integer("status_page_limit").notNull().default(0),
  teamMemberLimit: integer("team_member_limit").notNull().default(1),

  // Feature flags
  emailAlerts: boolean("email_alerts").notNull().default(true),
  webhookAlerts: boolean("webhook_alerts").notNull().default(false),
  telegramAlerts: boolean("telegram_alerts").notNull().default(false),
  sslMonitoring: boolean("ssl_monitoring").notNull().default(false),

  // Presentation / state
  isActive: boolean("is_active").notNull().default(true),
  isFree: boolean("is_free").notNull().default(false),
  isUnlimited: boolean("is_unlimited").notNull().default(false),
  isPopular: boolean("is_popular").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Plan = typeof plansTable.$inferSelect;
export type InsertPlan = typeof plansTable.$inferInsert;
