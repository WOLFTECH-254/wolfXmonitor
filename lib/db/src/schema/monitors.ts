import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const monitorStatusEnum = pgEnum("monitor_status", ["up", "down", "unknown"]);
export const pingStatusEnum = pgEnum("ping_status", ["up", "down"]);

export const monitorsTable = pgTable("monitors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  intervalMinutes: integer("interval_minutes").notNull().default(5),
  active: boolean("active").notNull().default(true),
  lastPingedAt: timestamp("last_pinged_at"),
  lastStatus: monitorStatusEnum("last_status").notNull().default("unknown"),
  lastResponseTimeMs: integer("last_response_time_ms"),
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

export const insertMonitorSchema = createInsertSchema(monitorsTable).omit({ id: true, createdAt: true, lastPingedAt: true, lastStatus: true, lastResponseTimeMs: true });
export const updateMonitorSchema = insertMonitorSchema.partial();

export type InsertMonitor = z.infer<typeof insertMonitorSchema>;
export type Monitor = typeof monitorsTable.$inferSelect;
export type InsertPing = typeof pingsTable.$inferInsert;
export type Ping = typeof pingsTable.$inferSelect;
