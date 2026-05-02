import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  notificationEmail: text("notification_email"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  isAdmin: boolean("is_admin").notNull().default(false),
  country: text("country"),
  plan: text("plan").notNull().default("free"),
  planSlug: text("plan_slug"),
  planExpiresAt: timestamp("plan_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
