import { pgTable, serial, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Nullable: accounts created via Google/GitHub have no password.
  passwordHash: text("password_hash"),
  // Social login link ("google" | "github") + the provider's user id.
  oauthProvider: text("oauth_provider"),
  oauthId: text("oauth_id"),
  notificationEmail: text("notification_email"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  isAdmin: boolean("is_admin").notNull().default(false),
  country: text("country"),
  plan: text("plan").notNull().default("free"),
  planSlug: text("plan_slug"),
  planExpiresAt: timestamp("plan_expires_at"),
  telegramChatId: text("telegram_chat_id"),
  whatsappPhone: text("whatsapp_phone"),
  discordWebhookUrl: text("discord_webhook_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("users_oauth_idx").on(t.oauthProvider, t.oauthId),
]);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
