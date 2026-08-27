import { Router } from "express";
import crypto from "node:crypto";
import axios from "axios";
import { db, usersTable, settingsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { sendSignupWelcomeEmail } from "../lib/mailer";
import { logger } from "../lib/logger";

const router = Router();

type Provider = "google" | "github";

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientIdKey: string;
  clientSecretKey: string;
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    clientIdKey: "oauth_google_client_id",
    clientSecretKey: "oauth_google_client_secret",
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    clientIdKey: "oauth_github_client_id",
    clientSecretKey: "oauth_github_client_secret",
  },
};

async function getSettingsMap() {
  const rows = await db.select().from(settingsTable);
  return new Map(rows.map((r) => [r.key, r.value]));
}

function isProvider(v: string): v is Provider {
  return v === "google" || v === "github";
}

function redirectUri(req: import("express").Request, provider: Provider) {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] || req.protocol;
  const host = req.get("host");
  return `${proto}://${host}/api/auth/oauth/${provider}/callback`;
}

/** Which providers are configured (client id + secret present). */
router.get("/auth/oauth/providers", async (_req, res) => {
  const map = await getSettingsMap();
  const configured = (p: Provider) =>
    !!map.get(PROVIDERS[p].clientIdKey)?.trim() && !!map.get(PROVIDERS[p].clientSecretKey)?.trim();
  res.json({ google: configured("google"), github: configured("github") });
});

/** Step 1 — bounce the user to the provider's consent screen. */
router.get("/auth/oauth/:provider", async (req, res) => {
  const { provider } = req.params;
  if (!isProvider(provider)) { res.status(404).json({ error: "Unknown provider" }); return; }

  const map = await getSettingsMap();
  const cfg = PROVIDERS[provider];
  const clientId = map.get(cfg.clientIdKey)?.trim();
  if (!clientId) {
    res.redirect(`/signin?error=${encodeURIComponent(`${provider} sign-in is not configured`)}`);
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;
  req.session.oauthProvider = provider;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(req, provider),
    response_type: "code",
    scope: cfg.scope,
    state,
  });
  if (provider === "google") {
    params.set("access_type", "online");
    params.set("prompt", "select_account");
  }
  res.redirect(`${cfg.authorizeUrl}?${params.toString()}`);
});

/** Step 2 — provider redirects back here with a code. */
router.get("/auth/oauth/:provider/callback", async (req, res) => {
  const { provider } = req.params;
  const { code, state, error: providerError } = req.query as Record<string, string | undefined>;
  const fail = (msg: string) => res.redirect(`/signin?error=${encodeURIComponent(msg)}`);

  if (!isProvider(provider)) { fail("Unknown provider"); return; }
  if (providerError) { fail(`${provider} sign-in was cancelled`); return; }
  if (!code || !state || state !== req.session.oauthState || provider !== req.session.oauthProvider) {
    fail("Sign-in verification failed — please try again");
    return;
  }
  delete req.session.oauthState;
  delete req.session.oauthProvider;

  const cfg = PROVIDERS[provider];
  const map = await getSettingsMap();
  const clientId = map.get(cfg.clientIdKey)?.trim();
  const clientSecret = map.get(cfg.clientSecretKey)?.trim();
  if (!clientId || !clientSecret) { fail(`${provider} sign-in is not configured`); return; }

  try {
    // --- exchange code for an access token ---
    const tokenRes = await axios.post(
      cfg.tokenUrl,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri(req, provider),
        grant_type: "authorization_code",
      }).toString(),
      { headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, timeout: 10000 },
    );
    const accessToken = (tokenRes.data as { access_token?: string }).access_token;
    if (!accessToken) { fail("Could not complete sign-in"); return; }

    // --- fetch the profile ---
    let providerId: string;
    let email: string | null = null;
    let emailVerified = false;
    let name: string;

    if (provider === "google") {
      const { data } = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { authorization: `Bearer ${accessToken}` }, timeout: 10000,
      });
      const u = data as { sub: string; email?: string; email_verified?: boolean; name?: string };
      providerId = u.sub;
      email = u.email?.toLowerCase() ?? null;
      emailVerified = !!u.email_verified;
      name = u.name || email?.split("@")[0] || "User";
    } else {
      const headers = { authorization: `Bearer ${accessToken}`, "user-agent": "GuardiX", accept: "application/vnd.github+json" };
      const { data: gh } = await axios.get("https://api.github.com/user", { headers, timeout: 10000 });
      const u = gh as { id: number; login: string; name?: string; email?: string };
      providerId = String(u.id);
      name = u.name || u.login || "User";
      email = u.email?.toLowerCase() ?? null;
      // The /user endpoint often returns a null email; the /user/emails
      // endpoint has the verified primary address.
      try {
        const { data: emails } = await axios.get("https://api.github.com/user/emails", { headers, timeout: 10000 });
        const list = emails as { email: string; primary: boolean; verified: boolean }[];
        const primary = list.find((e) => e.primary) ?? list[0];
        if (primary) { email = primary.email.toLowerCase(); emailVerified = primary.verified ?? false; }
      } catch { /* keep whatever /user gave us */ }
    }

    if (!email) { fail("Your account has no email address we can use"); return; }

    // --- find or create the user ---
    let [user] = await db.select().from(usersTable).where(
      and(eq(usersTable.oauthProvider, provider), eq(usersTable.oauthId, providerId)),
    );

    if (!user) {
      const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (byEmail) {
        if (!emailVerified) { fail("An account with this email already exists — sign in with your password"); return; }
        [user] = await db.update(usersTable)
          .set({ oauthProvider: provider, oauthId: providerId })
          .where(eq(usersTable.id, byEmail.id))
          .returning();
      } else {
        const [{ total }] = await db.select({ total: count() }).from(usersTable);
        [user] = await db.insert(usersTable).values({
          name: name.trim().slice(0, 120),
          email,
          passwordHash: null,
          notificationEmail: email,
          notificationsEnabled: true,
          isAdmin: Number(total) === 0,
          oauthProvider: provider,
          oauthId: providerId,
          plan: "free",
        }).returning();
        sendSignupWelcomeEmail({ toEmail: user.email, toName: user.name }).catch(() => {});
        logger.info({ userId: user.id, provider }, "New user via OAuth");
      }
    }

    req.session.userId = user.id;
    res.redirect("/dashboard");
  } catch (err) {
    logger.error({ err: String(err), provider }, "OAuth callback failed");
    fail("Sign-in failed — please try again");
  }
});

export default router;
