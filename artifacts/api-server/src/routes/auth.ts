import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, securityEventsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { getClientIp } from "../middlewares/ip-block";
import { sendSecurityAlert } from "../lib/security-mailer";
import { sendSignupWelcomeEmail } from "../lib/mailer";
import { logger } from "../lib/logger";
import {
  sendTelegramMessage,
  sendWhatsAppMessage,
  sendDiscordAlert,
  buildDownMessage,
  buildDownMessagePlain,
} from "../lib/notifier";

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
    telegramChatId: u.telegramChatId ?? null,
    whatsappPhone: u.whatsappPhone ?? null,
    discordWebhookUrl: u.discordWebhookUrl ?? null,
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

// ── Profile update ───────────────────────────────────────────────────────────

router.put("/me/profile", async (req, res) => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { name, email, notificationEmail } = req.body as {
    name?: string; email?: string; notificationEmail?: string;
  };
  if (!name?.trim() || !email?.trim()) {
    res.status(400).json({ error: "Name and email are required" });
    return;
  }
  const emailLower = email.toLowerCase().trim();
  const existing = await db.select().from(usersTable)
    .where(eq(usersTable.email, emailLower));
  if (existing.length > 0 && existing[0].id !== req.session.userId) {
    res.status(409).json({ error: "That email is already in use by another account" });
    return;
  }
  const [updated] = await db.update(usersTable).set({
    name: name.trim(),
    email: emailLower,
    notificationEmail: notificationEmail?.trim() || emailLower,
  }).where(eq(usersTable.id, req.session.userId)).returning();
  logger.info({ userId: req.session.userId }, "Profile updated");
  res.json(safeUser(updated));
});

router.put("/me/password", async (req, res) => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string; newPassword?: string;
  };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current password and new password are required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, req.session.userId));
  logger.info({ userId: req.session.userId }, "Password changed");
  res.json({ ok: true });
});

// ── Notification channel settings ────────────────────────────────────────────

router.get("/me/channels", async (req, res) => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  res.json({
    telegramChatId: user.telegramChatId ?? null,
    whatsappPhone: user.whatsappPhone ?? null,
    discordWebhookUrl: user.discordWebhookUrl ?? null,
  });
});

router.put("/me/channels", async (req, res) => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { telegramChatId, whatsappPhone, discordWebhookUrl } = req.body as {
    telegramChatId?: string;
    whatsappPhone?: string;
    discordWebhookUrl?: string;
  };
  await db.update(usersTable).set({
    telegramChatId: telegramChatId?.trim() || null,
    whatsappPhone: whatsappPhone?.trim() || null,
    discordWebhookUrl: discordWebhookUrl?.trim() || null,
  }).where(eq(usersTable.id, req.session.userId));
  logger.info({ userId: req.session.userId }, "Notification channels updated");
  res.json({ ok: true });
});

router.post("/me/channels/test", async (req, res) => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { channel } = req.body as { channel?: "telegram" | "whatsapp" | "discord" };
  if (!channel) { res.status(400).json({ error: "channel required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  if (channel === "telegram") {
    if (!user.telegramChatId) { res.status(400).json({ error: "No Telegram Chat ID saved yet." }); return; }
    await sendTelegramMessage(
      user.telegramChatId,
      buildDownMessage("test-monitor", "https://example.com", null)
        .replace("is DOWN", "test — ✅ Telegram is connected!")
        .replace("GuardiX is watching — you'll be notified when it recovers.", "GuardiX alerts are now active on this chat.")
    );
  } else if (channel === "whatsapp") {
    if (!user.whatsappPhone) { res.status(400).json({ error: "No WhatsApp number saved yet." }); return; }
    await sendWhatsAppMessage(
      user.whatsappPhone,
      buildDownMessagePlain("test-monitor", "https://example.com", null)
        .replace("is DOWN", "test — WhatsApp is connected!")
        .replace("You'll be notified when it recovers.", "GuardiX alerts are now active on this number.")
    );
  } else {
    if (!user.discordWebhookUrl) { res.status(400).json({ error: "No Discord webhook URL saved yet." }); return; }
    await sendDiscordAlert(user.discordWebhookUrl, "test", "test-monitor", "https://example.com");
  }
  res.json({ ok: true });
});

export default router;
