import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Session store table for `connect-pg-simple` (express-session).
 * Schema must match what connect-pg-simple expects — column names and the
 * `IDX_session_expire` index are load-bearing. Managed here so `db:push`
 * provisions it instead of relying on `createTableIfMissing` (which fails
 * against the bundled API build).
 */
export const userSessionsTable = pgTable(
  "user_sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6, mode: "date" }).notNull(),
  },
  (t) => [index("IDX_session_expire").on(t.expire)],
);

export type UserSession = typeof userSessionsTable.$inferSelect;
