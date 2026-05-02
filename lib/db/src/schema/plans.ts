import { pgTable, serial, text, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  durationDays: integer("duration_days").notNull(),
  priceUsd: numeric("price_usd", { precision: 10, scale: 2 }).notNull().default("0"),
  monitorLimit: integer("monitor_limit").notNull().default(-1),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Plan = typeof plansTable.$inferSelect;
