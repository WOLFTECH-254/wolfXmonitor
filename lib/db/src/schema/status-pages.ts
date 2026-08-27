import { pgTable, serial, integer, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { monitorsTable } from "./monitors";

/**
 * Named, shareable status pages. The legacy global page at /status (all of a
 * user's monitors) is unchanged; these are additional curated pages, capped by
 * the plan's statusPageLimit (-1 = unlimited, 0 = feature off).
 */
export const statusPagesTable = pgTable("status_pages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const statusPageMonitorsTable = pgTable("status_page_monitors", {
  id: serial("id").primaryKey(),
  statusPageId: integer("status_page_id").notNull().references(() => statusPagesTable.id, { onDelete: "cascade" }),
  monitorId: integer("monitor_id").notNull().references(() => monitorsTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [
  uniqueIndex("status_page_monitor_idx").on(t.statusPageId, t.monitorId),
]);

export type StatusPage = typeof statusPagesTable.$inferSelect;
export type StatusPageMonitor = typeof statusPageMonitorsTable.$inferSelect;
