import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const securityEventsTable = pgTable("security_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  ip: text("ip").notNull(),
  path: text("path"),
  method: text("method"),
  userAgent: text("user_agent"),
  details: text("details"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const blockedIpsTable = pgTable("blocked_ips", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull().unique(),
  reason: text("reason"),
  blockedBy: integer("blocked_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SecurityEvent = typeof securityEventsTable.$inferSelect;
export type BlockedIp = typeof blockedIpsTable.$inferSelect;
