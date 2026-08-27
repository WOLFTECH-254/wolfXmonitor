import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const monitorStatusEnum = pgEnum("monitor_status", ["up", "down", "unknown"]);
export const pingStatusEnum = pgEnum("ping_status", ["up", "down"]);

export const monitorsTable = pgTable("monitors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  // Legacy minutes column (kept in sync). checkIntervalSeconds is canonical and
  // supports sub-minute plans.
  intervalMinutes: integer("interval_minutes").notNull().default(5),
  checkIntervalSeconds: integer("check_interval_seconds").notNull().default(300),
  active: boolean("active").notNull().default(true),
  lastPingedAt: timestamp("last_pinged_at"),
  lastStatus: monitorStatusEnum("last_status").notNull().default("unknown"),
  lastResponseTimeMs: integer("last_response_time_ms"),
  lastNotifiedDownAt: timestamp("last_notified_down_at"),
  // SSL certificate monitoring (plan-gated).
  sslCheckEnabled: boolean("ssl_check_enabled").notNull().default(false),
  sslStatus: text("ssl_status").notNull().default("unknown"), // valid | expiring | expired | error | unknown
  sslExpiresAt: timestamp("ssl_expires_at"),
  sslDaysRemaining: integer("ssl_days_remaining"),
  sslIssuer: text("ssl_issuer"),
  sslLastCheckedAt: timestamp("ssl_last_checked_at"),
  sslLastNotifiedAt: timestamp("ssl_last_notified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pingsTable = pgTable("pings", {
  id: serial("id").primaryKey(),
  monitorId: integer("monitor_id").notNull().references(() => monitorsTable.id, { onDelete: "cascade" }),
  status: pingStatusEnum("status").notNull(),
  responseTimeMs: integer("response_time_ms"),
  statusCode: integer("status_code"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMonitorSchema = createInsertSchema(monitorsTable).omit({
  id: true, createdAt: true, lastPingedAt: true, lastStatus: true, lastResponseTimeMs: true,
  lastNotifiedDownAt: true, sslStatus: true, sslExpiresAt: true, sslDaysRemaining: true,
  sslIssuer: true, sslLastCheckedAt: true, sslLastNotifiedAt: true,
});
export const updateMonitorSchema = insertMonitorSchema.partial();

export type InsertMonitor = z.infer<typeof insertMonitorSchema>;
export type Monitor = typeof monitorsTable.$inferSelect;
export type InsertPing = typeof pingsTable.$inferInsert;
export type Ping = typeof pingsTable.$inferSelect;
