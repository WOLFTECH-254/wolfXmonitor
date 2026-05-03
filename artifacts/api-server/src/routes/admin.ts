import { Router } from "express";
import { db, monitorsTable, pingsTable, usersTable, settingsTable, paymentsTable, plansTable } from "@workspace/db";
import { desc, count, eq, sql, asc } from "drizzle-orm";
import axios from "axios";
import { requireAdmin } from "../middlewares/admin";
import { scheduleMonitor, unscheduleMonitor } from "../lib/scheduler";

const router = Router();

// ── Public: user counts by country (no auth needed) ─────────────────────────
router.get("/stats/countries", async (_req, res) => {
  const rows = await db
    .select({ country: usersTable.country, count: count() })
    .from(usersTable)
    .where(sql`${usersTable.country} IS NOT NULL AND ${usersTable.country} != ''`)
    .groupBy(usersTable.country)
    .orderBy(desc(count()));
  res.json(rows);
});

router.get("/admin/stats", requireAdmin, async (_req, res) => {
  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [monitorCount] = await db.select({ count: count() }).from(monitorsTable);
  const [pingCount] = await db.select({ count: count() }).from(pingsTable);

  const monitors = await db.select({ lastStatus: monitorsTable.lastStatus }).from(monitorsTable);
  const up = monitors.filter((m) => m.lastStatus === "up").length;
  const down = monitors.filter((m) => m.lastStatus === "down").length;
  const unknown = monitors.filter((m) => m.lastStatus === "unknown").length;

  const [pingTotals] = await db.select({
    total: count(),
    upCount: sql<number>`count(*) filter (where ${pingsTable.status} = 'up')`,
  }).from(pingsTable);

  const total = Number(pingTotals?.total ?? 0);
  const upPings = Number(pingTotals?.upCount ?? 0);
  const globalUptime = total > 0 ? (upPings / total) * 100 : 100;

  res.json({
    totalUsers: Number(userCount?.count ?? 0),
    totalMonitors: Number(monitorCount?.count ?? 0),
    totalPings: Number(pingCount?.count ?? 0),
    monitorsUp: up,
    monitorsDown: down,
    monitorsUnknown: unknown,
    globalUptime,
  });
});

router.get("/admin/users", requireAdmin, async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const monitorCounts = await db
    .select({ userId: monitorsTable.userId, count: count() })
    .from(monitorsTable)
    .groupBy(monitorsTable.userId);

  const countMap = new Map(monitorCounts.map((r) => [r.userId, Number(r.count)]));

  const result = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.isAdmin,
    notificationsEnabled: u.notificationsEnabled,
    monitorCount: countMap.get(u.id) ?? 0,
    createdAt: u.createdAt,
    plan: u.plan ?? "free",
    country: u.country ?? null,
  }));

  res.json(result);
});

router.get("/admin/monitors", requireAdmin, async (_req, res) => {
  const monitors = await db
    .select({
      id: monitorsTable.id,
      name: monitorsTable.name,
      url: monitorsTable.url,
      intervalMinutes: monitorsTable.intervalMinutes,
      active: monitorsTable.active,
      lastStatus: monitorsTable.lastStatus,
      lastPingedAt: monitorsTable.lastPingedAt,
      lastResponseTimeMs: monitorsTable.lastResponseTimeMs,
      createdAt: monitorsTable.createdAt,
      userId: monitorsTable.userId,
      userName: usersTable.name,
      userEmail: usersTable.email,
    })
    .from(monitorsTable)
    .leftJoin(usersTable, eq(monitorsTable.userId, usersTable.id))
    .orderBy(desc(monitorsTable.createdAt));

  res.json(monitors);
});

router.get("/admin/activity", requireAdmin, async (_req, res) => {
  const activity = await db
    .select({
      id: pingsTable.id,
      status: pingsTable.status,
      responseTimeMs: pingsTable.responseTimeMs,
      statusCode: pingsTable.statusCode,
      error: pingsTable.error,
      createdAt: pingsTable.createdAt,
      monitorId: monitorsTable.id,
      monitorName: monitorsTable.name,
      monitorUrl: monitorsTable.url,
      userName: usersTable.name,
    })
    .from(pingsTable)
    .leftJoin(monitorsTable, eq(pingsTable.monitorId, monitorsTable.id))
    .leftJoin(usersTable, eq(monitorsTable.userId, usersTable.id))
    .orderBy(desc(pingsTable.createdAt))
    .limit(100);

  res.json(activity);
});

router.patch("/admin/monitors/:id/toggle", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [monitor] = await db.select().from(monitorsTable).where(eq(monitorsTable.id, id));
  if (!monitor) { res.status(404).json({ error: "Not found" }); return; }
  const newActive = !monitor.active;
  const [updated] = await db
    .update(monitorsTable)
    .set({ active: newActive })
    .where(eq(monitorsTable.id, id))
    .returning();
  if (newActive) scheduleMonitor(id, monitor.url, monitor.intervalMinutes);
  else unscheduleMonitor(id);
  res.json(updated);
});

router.delete("/admin/monitors/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  unscheduleMonitor(id);
  await db.delete(monitorsTable).where(eq(monitorsTable.id, id));
  res.status(204).send();
});

router.patch("/admin/users/:id/toggle-admin", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db
    .update(usersTable)
    .set({ isAdmin: !user.isAdmin })
    .where(eq(usersTable.id, id))
    .returning();
  res.json({ id: updated.id, isAdmin: updated.isAdmin });
});

router.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

// ── Plans CRUD ───────────────────────────────────────────────────────────────

router.get("/admin/plans", requireAdmin, async (_req, res) => {
  const plans = await db.select().from(plansTable).orderBy(asc(plansTable.sortOrder));
  res.json(plans);
});

router.put("/admin/plans/:slug", requireAdmin, async (req, res) => {
  const { slug } = req.params;
  const { priceUsd, monitorLimit, isActive, name } = req.body as {
    priceUsd?: number; monitorLimit?: number; isActive?: boolean; name?: string;
  };
  const set: Record<string, unknown> = {};
  if (priceUsd !== undefined && priceUsd >= 0) set.priceUsd = String(priceUsd);
  if (monitorLimit !== undefined) set.monitorLimit = monitorLimit;
  if (isActive !== undefined) set.isActive = isActive;
  if (name?.trim()) set.name = name.trim();

  const [updated] = await db.update(plansTable).set(set).where(eq(plansTable.slug, slug)).returning();
  if (!updated) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json(updated);
});

// ── Payments ────────────────────────────────────────────────────────────────

router.get("/admin/payments", requireAdmin, async (_req, res) => {
  const payments = await db
    .select({
      id: paymentsTable.id,
      paystackReference: paymentsTable.paystackReference,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      plan: paymentsTable.plan,
      createdAt: paymentsTable.createdAt,
      userId: paymentsTable.userId,
      userName: usersTable.name,
      userEmail: usersTable.email,
    })
    .from(paymentsTable)
    .leftJoin(usersTable, eq(paymentsTable.userId, usersTable.id))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(100);
  res.json(payments);
});

// ── Email / Brevo settings ─────────────────────────────────────────────────

const upsertSetting = async (key: string, value: string) => {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
};

router.get("/admin/settings/email", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const rawKey = map.get("brevo_api_key") ?? process.env.BREVO_API_KEY ?? "";
  const maskedKey = rawKey.length > 8
    ? `${"•".repeat(rawKey.length - 4)}${rawKey.slice(-4)}`
    : rawKey ? "••••" : "";

  res.json({
    brevoApiKeySet: rawKey.length > 0,
    brevoApiKeyMasked: maskedKey,
    senderEmail: map.get("brevo_sender_email") ?? process.env.BREVO_SENDER_EMAIL ?? "alerts@xwolf.space",
    senderName: map.get("brevo_sender_name") ?? process.env.BREVO_SENDER_NAME ?? "wolfXmonitor",
  });
});

router.put("/admin/settings/email", requireAdmin, async (req, res) => {
  const { brevoApiKey, senderEmail, senderName } = req.body as {
    brevoApiKey?: string; senderEmail?: string; senderName?: string;
  };
  if (brevoApiKey && brevoApiKey.trim() && !brevoApiKey.includes("•")) {
    await upsertSetting("brevo_api_key", brevoApiKey.trim());
  }
  if (senderEmail?.trim()) await upsertSetting("brevo_sender_email", senderEmail.trim());
  if (senderName?.trim()) await upsertSetting("brevo_sender_name", senderName.trim());
  res.json({ ok: true });
});

// ── Paystack / Billing settings ─────────────────────────────────────────────

router.get("/admin/settings/billing", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const rawSecret = map.get("paystack_secret_key") ?? "";
  const rawPublic = map.get("paystack_public_key") ?? "";
  const maskedSecret = rawSecret.length > 8
    ? `${"•".repeat(rawSecret.length - 4)}${rawSecret.slice(-4)}`
    : rawSecret ? "••••" : "";

  res.json({
    paystackSecretKeySet: rawSecret.length > 0,
    paystackSecretKeyMasked: maskedSecret,
    paystackPublicKey: rawPublic,
    paystackCurrency: map.get("paystack_currency") ?? "KES",
    freeMonitorLimit: Number(map.get("free_monitor_limit") ?? "5"),
  });
});

router.put("/admin/settings/billing", requireAdmin, async (req, res) => {
  const { paystackSecretKey, paystackPublicKey, paystackCurrency, freeMonitorLimit } = req.body as {
    paystackSecretKey?: string; paystackPublicKey?: string;
    paystackCurrency?: string; freeMonitorLimit?: number;
  };
  if (paystackSecretKey && paystackSecretKey.trim() && !paystackSecretKey.includes("•")) {
    await upsertSetting("paystack_secret_key", paystackSecretKey.trim());
  }
  if (paystackPublicKey?.trim()) await upsertSetting("paystack_public_key", paystackPublicKey.trim());
  if (paystackCurrency?.trim()) await upsertSetting("paystack_currency", paystackCurrency.trim());
  if (freeMonitorLimit !== undefined && freeMonitorLimit > 0) await upsertSetting("free_monitor_limit", String(freeMonitorLimit));
  res.json({ ok: true });
});

// ── Plan management ─────────────────────────────────────────────────────────

router.patch("/admin/users/:id/plan", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { plan } = req.body as { plan?: string };
  if (!plan || !["free", "pro"].includes(plan)) {
    res.status(400).json({ error: "plan must be 'free' or 'pro'" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ plan })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, plan: usersTable.plan });
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ── Footer / Site settings ────────────────────────────────────────────────

const FOOTER_KEYS = [
  "footer_twitter", "footer_instagram", "footer_facebook",
  "footer_linkedin", "footer_youtube",
  "footer_privacy_url", "footer_terms_url", "footer_tagline",
] as const;

router.get("/settings/site", async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  res.json({
    twitterUrl:   map.get("footer_twitter")     ?? "",
    instagramUrl: map.get("footer_instagram")   ?? "",
    facebookUrl:  map.get("footer_facebook")    ?? "",
    linkedinUrl:  map.get("footer_linkedin")    ?? "",
    youtubeUrl:   map.get("footer_youtube")     ?? "",
    privacyUrl:   map.get("footer_privacy_url") ?? "",
    termsUrl:     map.get("footer_terms_url")   ?? "",
    tagline:      map.get("footer_tagline")     ?? "",
  });
});

router.get("/admin/settings/site", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  res.json({
    twitterUrl:   map.get("footer_twitter")     ?? "",
    instagramUrl: map.get("footer_instagram")   ?? "",
    facebookUrl:  map.get("footer_facebook")    ?? "",
    linkedinUrl:  map.get("footer_linkedin")    ?? "",
    youtubeUrl:   map.get("footer_youtube")     ?? "",
    privacyUrl:   map.get("footer_privacy_url") ?? "",
    termsUrl:     map.get("footer_terms_url")   ?? "",
    tagline:      map.get("footer_tagline")     ?? "",
  });
});

router.put("/admin/settings/site", requireAdmin, async (req, res) => {
  const body = req.body as {
    twitterUrl?: string; instagramUrl?: string; facebookUrl?: string;
    linkedinUrl?: string; youtubeUrl?: string;
    privacyUrl?: string; termsUrl?: string; tagline?: string;
  };
  const pairs: [string, string][] = [
    ["footer_twitter",     body.twitterUrl   ?? ""],
    ["footer_instagram",   body.instagramUrl ?? ""],
    ["footer_facebook",    body.facebookUrl  ?? ""],
    ["footer_linkedin",    body.linkedinUrl  ?? ""],
    ["footer_youtube",     body.youtubeUrl   ?? ""],
    ["footer_privacy_url", body.privacyUrl   ?? ""],
    ["footer_terms_url",   body.termsUrl     ?? ""],
    ["footer_tagline",     body.tagline      ?? ""],
  ];
  for (const [key, value] of pairs) {
    await upsertSetting(key, value);
  }
  res.json({ ok: true });
});

// ── OG / Social metadata settings ────────────────────────────────────────────

router.get("/settings/og", async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  res.json({
    ogTitle:       map.get("og_title")       ?? "wolfXmonitor — Know When Your Sites Go Down",
    ogDescription: map.get("og_description") ?? "Real-time uptime monitoring with instant alerts. Free & Pro plans.",
    ogImage:       map.get("og_image")       ?? "",
    ogUrl:         map.get("og_url")         ?? "https://monitor.xwolf.space",
  });
});

router.get("/admin/settings/og", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  res.json({
    ogTitle:       map.get("og_title")       ?? "wolfXmonitor — Know When Your Sites Go Down",
    ogDescription: map.get("og_description") ?? "Real-time uptime monitoring with instant alerts. Free & Pro plans.",
    ogImage:       map.get("og_image")       ?? "",
    ogUrl:         map.get("og_url")         ?? "https://monitor.xwolf.space",
  });
});

router.put("/admin/settings/og", requireAdmin, async (req, res) => {
  const { ogTitle, ogDescription, ogImage, ogUrl } = req.body as {
    ogTitle?: string; ogDescription?: string; ogImage?: string; ogUrl?: string;
  };
  if (ogTitle    !== undefined) await upsertSetting("og_title",       ogTitle.trim());
  if (ogDescription !== undefined) await upsertSetting("og_description", ogDescription.trim());
  if (ogImage    !== undefined) await upsertSetting("og_image",       ogImage.trim());
  if (ogUrl      !== undefined) await upsertSetting("og_url",         ogUrl.trim());
  res.json({ ok: true });
});

// ── Telegram + WhatsApp (Twilio) settings ─────────────────────────────────────

router.get("/admin/settings/chat", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  res.json({
    telegramBotToken: map.get("telegram_bot_token") ?? "",
    twilioAccountSid: map.get("twilio_account_sid") ?? "",
    twilioAuthToken: map.get("twilio_auth_token") ?? "",
    twilioWhatsappFrom: map.get("twilio_whatsapp_from") ?? "",
  });
});

router.put("/admin/settings/chat", requireAdmin, async (req, res) => {
  const { telegramBotToken, twilioAccountSid, twilioAuthToken, twilioWhatsappFrom } = req.body as {
    telegramBotToken?: string;
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioWhatsappFrom?: string;
  };
  if (telegramBotToken !== undefined) await upsertSetting("telegram_bot_token", telegramBotToken.trim());
  if (twilioAccountSid !== undefined) await upsertSetting("twilio_account_sid", twilioAccountSid.trim());
  if (twilioAuthToken !== undefined) await upsertSetting("twilio_auth_token", twilioAuthToken.trim());
  if (twilioWhatsappFrom !== undefined) await upsertSetting("twilio_whatsapp_from", twilioWhatsappFrom.trim());
  res.json({ ok: true });
});

// ── Security notification settings ────────────────────────────────────────────

router.get("/admin/settings/security", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  res.json({
    securityAlertEmail: map.get("security_alert_email") ?? "777wolfsilent8@gmail.com",
  });
});

router.put("/admin/settings/security", requireAdmin, async (req, res) => {
  const { securityAlertEmail } = req.body as { securityAlertEmail?: string };
  if (securityAlertEmail?.trim()) {
    await upsertSetting("security_alert_email", securityAlertEmail.trim());
  }
  res.json({ ok: true });
});

// ── Email test ────────────────────────────────────────────────────────────────

router.post("/admin/settings/email/test", requireAdmin, async (req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const apiKey = map.get("brevo_api_key") ?? process.env.BREVO_API_KEY ?? "";
  const senderEmail = map.get("brevo_sender_email") ?? process.env.BREVO_SENDER_EMAIL ?? "alerts@xwolf.space";
  const senderName = map.get("brevo_sender_name") ?? process.env.BREVO_SENDER_NAME ?? "wolfXmonitor";

  if (!apiKey) {
    res.status(400).json({ error: "No Brevo API key configured." });
    return;
  }

  const toEmail = (req.session as { userId?: number } & Express.Request["session"] & { userEmail?: string }).userEmail
    ?? (req as { user?: { email: string } }).user?.email
    ?? "";

  // Fetch the admin user's email from DB
  const [adminUser] = await db
    .select({ email: usersTable.email, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!adminUser) { res.status(400).json({ error: "User not found." }); return; }

  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: adminUser.email, name: adminUser.name }],
        subject: "wolfXmonitor — email test successful",
        htmlContent: `<div style="font-family:'Courier New',monospace;background:#080e0a;color:#d1ffd6;padding:32px;border-radius:8px;max-width:480px;">
          <div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:4px;">wolf<span style="color:#22c55e">X</span>monitor</div>
          <div style="font-size:10px;color:#4b7a55;letter-spacing:3px;text-transform:uppercase;margin-bottom:24px;border-bottom:1px solid #1a3a22;padding-bottom:12px;">Email Config Test</div>
          <div style="background:#0a1a0e;border:1px solid #22c55e55;border-radius:6px;padding:20px;margin-bottom:20px;">
            <div style="font-size:10px;color:#22c55e;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">✓ Connection verified</div>
            <div style="font-size:13px;color:#d1ffd6;">Your Brevo API key and sender are configured correctly. Alerts will be delivered to <strong>${adminUser.email}</strong>.</div>
          </div>
          <div style="font-size:10px;color:#4b5563;text-align:center;margin-top:20px;">Sent from ${senderEmail}</div>
        </div>`,
      },
      {
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      }
    );
    res.json({ ok: true, messageId: (response.data as { messageId?: string }).messageId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Brevo rejected the request: ${msg}` });
  }
});

// ── Developer profile settings ────────────────────────────────────────────────

const DEV_KEYS = [
  "dev_name", "dev_title", "dev_bio", "dev_avatar_url",
  "dev_github_username", "dev_github_url",
  "dev_twitter_url", "dev_linkedin_url", "dev_website_url",
  "dev_coffee_url", "dev_custom_links",
] as const;

function buildDevProfile(map: Map<string, string>) {
  return {
    name:           map.get("dev_name")            ?? "",
    title:          map.get("dev_title")           ?? "",
    bio:            map.get("dev_bio")             ?? "",
    avatarUrl:      map.get("dev_avatar_url")      ?? "",
    githubUsername: map.get("dev_github_username") ?? "",
    githubUrl:      map.get("dev_github_url")      ?? "",
    twitterUrl:     map.get("dev_twitter_url")     ?? "",
    linkedinUrl:    map.get("dev_linkedin_url")    ?? "",
    websiteUrl:     map.get("dev_website_url")     ?? "",
    coffeeUrl:      map.get("dev_coffee_url")      ?? "",
    customLinks:    JSON.parse(map.get("dev_custom_links") ?? "[]") as { label: string; url: string }[],
  };
}

router.get("/settings/developer", async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  res.json(buildDevProfile(map));
});

router.get("/admin/settings/developer", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  res.json(buildDevProfile(map));
});

router.put("/admin/settings/developer", requireAdmin, async (req, res) => {
  const {
    name, title, bio, avatarUrl,
    githubUsername, githubUrl,
    twitterUrl, linkedinUrl, websiteUrl,
    coffeeUrl, customLinks,
  } = req.body as {
    name?: string; title?: string; bio?: string; avatarUrl?: string;
    githubUsername?: string; githubUrl?: string;
    twitterUrl?: string; linkedinUrl?: string; websiteUrl?: string;
    coffeeUrl?: string; customLinks?: { label: string; url: string }[];
  };

  const pairs: [string, string][] = [
    ["dev_name",            name            ?? ""],
    ["dev_title",           title           ?? ""],
    ["dev_bio",             bio             ?? ""],
    ["dev_avatar_url",      avatarUrl       ?? ""],
    ["dev_github_username", githubUsername  ?? ""],
    ["dev_github_url",      githubUrl       ?? ""],
    ["dev_twitter_url",     twitterUrl      ?? ""],
    ["dev_linkedin_url",    linkedinUrl     ?? ""],
    ["dev_website_url",     websiteUrl      ?? ""],
    ["dev_coffee_url",      coffeeUrl       ?? ""],
    ["dev_custom_links",    JSON.stringify(customLinks ?? [])],
  ];
  for (const [key, value] of pairs) await upsertSetting(key, value);
  res.json({ ok: true });
});

export default router;
