import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Lightweight teams. Every account owns exactly one team (created lazily).
 * The plan's teamMemberLimit caps how many members (incl. the owner) a team
 * may have. v1 tracks membership + invites for limit enforcement; shared
 * monitor access across accounts is intentionally out of scope for now.
 */
export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("My Team"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("teams_owner_idx").on(t.ownerId),
]);

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  // Null until a pending invite is accepted / the invited email registers.
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"), // owner | admin | member
  status: text("status").notNull().default("pending"), // active | pending
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  joinedAt: timestamp("joined_at"),
}, (t) => [
  uniqueIndex("team_members_team_email_idx").on(t.teamId, t.email),
]);

export type Team = typeof teamsTable.$inferSelect;
export type TeamMember = typeof teamMembersTable.$inferSelect;
