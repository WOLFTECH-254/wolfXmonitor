import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, securityEventsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { getClientIp } from "../middlewares/ip-block";
import { sendSecurityAlert } from "../lib/security-mailer";
import { sendSignupWelcomeEmail } from "../lib/mailer";
import { logger } from "../lib/logger";

const router = Router();

const loginFailures = new Map<string, { count: number; firstAt: number }>();
const BRUTE_WINDOW_MS = 15 * 60 * 1000;
const BRUTE_THRESHOLD = 5;

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = loginFailures.get(ip);
  if (!entry || now - entry.firstAt > BRUTE_WINDOW_MS) {
    loginFailures.set(ip, { count: 1, firstAt: now });
  } else {
    entry.count += 1;
    if (entry.count >= BRUTE_THRESHOLD) {
      const details = `${entry.count} failed login attempts in ${Math.round((now - entry.firstAt) / 60000)} min`;
      db.insert(securityEventsTable).values({
        type: "brute_force",
        ip,
        path: "/api/auth/login",
        method: "POST",
        details,
      }).catch(() => {});
      sendSecurityAlert({ type: "brute_force", ip, path: "/api/auth/login", details }).catch(() => {});
      logger.warn({ ip, count: entry.count }, "Brute force detected");
    }
  }
}

function clearFailures(ip: string): void {
  loginFailures.delete(ip);
}

function safeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    notificationEmail: u.notificationEmail,
    notificationsEnabled: u.notificationsEnabled,
    isAdmin: u.isAdmin,
    country: u.country,
    plan: u.plan,
  };
}

router.post("/auth/register", async (req, res) => {
  const { name, email, password, country } = req.body as {
    name?: string; email?: string; password?: string; country?: string;
  };
  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email and password are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }
  const [{ total }] = await db.select({ total: count() }).from(usersTable);
  const isFirstUser = Number(total) === 0;

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    notificationEmail: email.toLowerCase().trim(),
    notificationsEnabled: true,
    isAdmin: isFirstUser,
    country: country?.trim() ?? null,
    plan: "free",
  }).returning();
  req.session.userId = user.id;
  sendSignupWelcomeEmail({ toEmail: user.email, toName: user.name }).catch(() => {});
  res.status(201).json(safeUser(user));
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const ip = getClientIp(req);

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));

  if (!user) {
    recordFailure(ip);
    db.insert(securityEventsTable).values({
      type: "login_fail",
      ip,
      path: "/api/auth/login",
      method: "POST",
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      details: `Failed login — email not found: ${email.toLowerCase().trim()}`,
    }).catch(() => {});
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    recordFailure(ip);
    db.insert(securityEventsTable).values({
      type: "login_fail",
      ip,
      path: "/api/auth/login",
      method: "POST",
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      details: `Failed login — wrong password for: ${email.toLowerCase().trim()}`,
    }).catch(() => {});
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  clearFailures(ip);
  req.session.userId = user.id;
  res.json(safeUser(user));
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(safeUser(user));
});

export default router;
