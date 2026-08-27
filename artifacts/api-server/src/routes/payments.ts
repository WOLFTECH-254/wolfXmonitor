import { Router } from "express";
import crypto from "node:crypto";
import axios from "axios";
import { db, paymentsTable, settingsTable, usersTable, plansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { sendPaymentConfirmEmail } from "../lib/mailer";
import { recomputeOverLimit } from "../lib/plan-enforcement";
import { logger } from "../lib/logger";

const router = Router();

const CURRENCY_MAP: Record<string, string> = {
  NG: "NGN", GH: "GHS", ZA: "ZAR", KE: "KES", US: "USD",
  GB: "GBP", EU: "EUR", CA: "CAD", AU: "AUD",
};

async function getSettings() {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    secretKey: map.get("paystack_secret_key") ?? "",
    publicKey: map.get("paystack_public_key") ?? "",
    freeLimit: Number(map.get("free_monitor_limit") ?? "5"),
    // Merchant's Paystack account currency — must match what the account supports
    merchantCurrency: map.get("paystack_currency") ?? "KES",
  };
}

async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    const { data } = await axios.get("https://open.er-api.com/v6/latest/USD", { timeout: 5000 });
    return (data as { rates: Record<string, number> }).rates ?? {};
  } catch {
    return {};
  }
}

// Active-plan listing lives in routes/plans.ts now.

// ── Config for upgrade page ──────────────────────────────────────────────────

router.get("/payments/config", requireAuth, async (req, res) => {
  const settings = await getSettings();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Always charge in the merchant's configured Paystack currency (not the user's country currency)
  const currency = settings.merchantCurrency;

  let exchangeRate = 1;
  if (currency !== "USD") {
    const rates = await getExchangeRates();
    exchangeRate = rates[currency] ?? 1;
  }

  res.json({
    publicKey: settings.publicKey,
    currency,
    exchangeRate,
    freeLimit: settings.freeLimit,
    userEmail: user.email,
    userName: user.name,
    userCountry: (user.country ?? "").toUpperCase().slice(0, 2),
    plan: user.plan,
    planSlug: user.planSlug ?? null,
    planExpiresAt: user.planExpiresAt ?? null,
  });
});

// ── Mobile money (M-Pesa STK push) — no inline popup ───────────────────────

/**
 * Reduce any accepted user input to the canonical Kenyan MSISDN 254XXXXXXXXX.
 * Accepts 0712…, 712…, +254712…, 254712…, with spaces / dashes / parens.
 */
function toKeMsisdn(raw: string): string | null {
  let p = (raw || "").replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (/^[71]\d{8}$/.test(p)) p = "254" + p;
  return /^254[17]\d{8}$/.test(p) ? p : null;
}

const isPhoneFormatError = (msg: string) => /phone|msisdn|number format|invalid number/i.test(msg);

router.post("/payments/charge/mpesa", requireAuth, async (req, res) => {
  const { planSlug, phone } = (req.body ?? {}) as { planSlug?: string; phone?: string };
  const userId = req.session.userId!;

  const settings = await getSettings();
  if (!settings.secretKey) { res.status(503).json({ error: "Payments are not configured yet." }); return; }

  const msisdn = toKeMsisdn(phone ?? "");
  if (!msisdn) { res.status(400).json({ error: "Enter a valid Safaricom number, e.g. 0712 345 678." }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, planSlug ?? ""));
  if (!plan || !plan.isActive) { res.status(400).json({ error: "Unknown plan" }); return; }
  if (plan.isFree) { res.status(400).json({ error: "The free plan needs no payment." }); return; }

  // Amount is computed server-side — never trust the browser.
  const currency = settings.merchantCurrency;
  let rate = 1;
  if (currency !== "USD") {
    const rates = await getExchangeRates();
    rate = rates[currency] ?? 1;
  }
  const priceUsd = Number(plan.priceUsd);
  const major = currency === "USD" ? priceUsd : Math.round(priceUsd * rate);
  const amountMinor = Math.round(major * 100);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    res.status(400).json({ error: "This plan has no price set. Contact support." });
    return;
  }

  const reference = `wxm_${plan.slug}_${Date.now()}_${userId}`;
  const local = "0" + msisdn.slice(3);      // 0712345678
  const bare = msisdn.slice(3);              // 712345678
  // Paystack's Charge API has been inconsistent about the KE M-Pesa phone
  // format across accounts — try the common encodings in order.
  const phoneCandidates = [`+${msisdn}`, msisdn, local, bare];

  let lastErr = "Unknown error";
  for (const candidate of phoneCandidates) {
    try {
      const { data: charge } = await axios.post(
        "https://api.paystack.co/charge",
        {
          email: user.email,
          amount: amountMinor,
          currency,
          reference,
          mobile_money: { phone: candidate, provider: "mpesa" },
          metadata: { userId, planSlug: plan.slug },
        },
        { headers: { Authorization: `Bearer ${settings.secretKey}` }, timeout: 20000 },
      );

      const cd = (charge as { data?: { status?: string; display_text?: string; message?: string } }).data ?? {};
      const status = cd.status ?? "pending";

      if (status === "failed") {
        const m = cd.message || "The M-Pesa charge was declined. Try again.";
        if (isPhoneFormatError(m)) { lastErr = m; continue; } // try the next phone encoding
        res.status(402).json({ error: m });
        return;
      }

      await db.insert(paymentsTable).values({
        userId,
        paystackReference: reference,
        amount: amountMinor,
        currency,
        status: "pending",
        plan: plan.slug,
      });

      res.json({
        reference,
        status,
        displayText: cd.display_text || "Enter your M-Pesa PIN on the prompt sent to your phone.",
      });
      return;
    } catch (err: unknown) {
      lastErr =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (err instanceof Error ? err.message : String(err));
      // Only keep trying other formats if this looks like a format rejection.
      if (!isPhoneFormatError(lastErr)) break;
    }
  }

  logger.warn({ userId, plan: plan.slug, msisdn, lastErr }, "M-Pesa charge could not be started");
  res.status(502).json({ error: `Could not start M-Pesa payment: ${lastErr}` });
});

// ── Verify after Paystack inline popup ──────────────────────────────────────

router.get("/payments/verify/:reference", requireAuth, async (req, res) => {
  const { reference } = req.params;
  const settings = await getSettings();

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${settings.secretKey}` } }
    );

    const data = (response.data as {
      data: {
        status: string;
        amount: number;
        currency: string;
        metadata?: { userId?: number; planSlug?: string };
      };
    }).data;

    if (data.status === "success") {
      // Extract plan slug from reference (format: wxm_<slug>_<timestamp>_<userId>),
      // preferring Paystack metadata. Validate against the plans table so any
      // admin-created slug works.
      const refParts = reference.split("_");
      const slugFromRef = refParts.length >= 2 ? refParts[1] : null;
      const candidate = data.metadata?.planSlug ?? slugFromRef ?? "pro";
      const [matched] = await db.select().from(plansTable).where(eq(plansTable.slug, candidate));
      const plan = matched
        ?? (await db.select().from(plansTable).where(eq(plansTable.slug, "pro")))[0]
        ?? (await db.select().from(plansTable).where(eq(plansTable.isActive, true)).orderBy(desc(plansTable.priceUsd)))[0];
      const planSlug = plan?.slug ?? "pro";
      const durationDays = plan?.durationDays ?? 30;

      const now = new Date();
      const planExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Upsert payment record
      const existing = await db.select().from(paymentsTable).where(eq(paymentsTable.paystackReference, reference));
      if (existing.length > 0) {
        await db.update(paymentsTable).set({ status: "success", plan: planSlug }).where(eq(paymentsTable.paystackReference, reference));
      } else {
        await db.insert(paymentsTable).values({
          userId: req.session.userId!,
          paystackReference: reference,
          amount: data.amount,
          currency: data.currency,
          status: "success",
          plan: planSlug,
        });
      }

      // Update user's subscription
      await db.update(usersTable)
        .set({
          plan: plan?.isFree ? "free" : "pro",
          planSlug,
          subscriptionStatus: "active",
          subscriptionStartedAt: now,
          planExpiresAt,
          overLimitSince: null, // an upgrade always clears the over-limit gate
        })
        .where(eq(usersTable.id, req.session.userId!));
      await recomputeOverLimit(req.session.userId!);

      // Send payment confirmation email (fire-and-forget)
      const [updatedUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
      if (updatedUser) {
        sendPaymentConfirmEmail({
          toEmail: updatedUser.email,
          toName: updatedUser.name,
          amount: data.amount,
          currency: data.currency,
          planSlug,
          planExpiresAt,
        }).catch(() => {});
      }

      res.json({ ok: true, plan: "pro", planSlug, planExpiresAt });
    } else {
      const existing = await db.select().from(paymentsTable).where(eq(paymentsTable.paystackReference, reference));
      if (existing.length > 0) {
        await db.update(paymentsTable).set({ status: data.status }).where(eq(paymentsTable.paystackReference, reference));
      }
      res.json({ ok: false, status: data.status });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Verification error: ${msg}` });
  }
});

// ── Webhook (server-to-server from Paystack) ────────────────────────────────

router.post("/payments/webhook", async (req, res) => {
  // Verify this really came from Paystack: HMAC-SHA512 of the raw body,
  // keyed with our secret key, must match the x-paystack-signature header.
  const { secretKey } = await getSettings();
  const signature = req.headers["x-paystack-signature"];
  const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!secretKey || !raw || typeof signature !== "string") {
    res.sendStatus(401);
    return;
  }
  const expected = crypto.createHmac("sha512", secretKey).update(raw).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    res.sendStatus(401);
    return;
  }

  const event = req.body as {
    event?: string;
    data?: {
      reference?: string;
      status?: string;
      amount?: number;
      currency?: string;
      metadata?: { userId?: number; planSlug?: string };
    };
  };

  if (event.event === "charge.success" && event.data?.reference) {
    const { reference, metadata, amount, currency } = event.data;
    const planSlug = metadata?.planSlug ?? "pro";

    const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, planSlug));
    const durationDays = plan?.durationDays ?? 30;
    const planExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const existing = await db.select().from(paymentsTable).where(eq(paymentsTable.paystackReference, reference));
    if (existing.length > 0) {
      await db.update(paymentsTable).set({ status: "success", plan: planSlug }).where(eq(paymentsTable.paystackReference, reference));
    } else if (metadata?.userId) {
      await db.insert(paymentsTable).values({
        userId: metadata.userId,
        paystackReference: reference!,
        amount: amount ?? 0,
        currency: currency ?? "USD",
        status: "success",
        plan: planSlug,
      });
    }

    if (metadata?.userId) {
      await db.update(usersTable)
        .set({
          plan: plan?.isFree ? "free" : "pro",
          planSlug,
          subscriptionStatus: "active",
          subscriptionStartedAt: new Date(),
          planExpiresAt,
          overLimitSince: null,
        })
        .where(eq(usersTable.id, metadata.userId));
      await recomputeOverLimit(metadata.userId);

      // Send payment confirmation email (fire-and-forget)
      const [webhookUser] = await db.select().from(usersTable).where(eq(usersTable.id, metadata.userId));
      if (webhookUser) {
        sendPaymentConfirmEmail({
          toEmail: webhookUser.email,
          toName: webhookUser.name,
          amount: event.data?.amount ?? 0,
          currency: event.data?.currency ?? "KES",
          planSlug,
          planExpiresAt,
        }).catch(() => {});
      }
    }
  }

  res.json({ ok: true });
});

export { getSettings };
export default router;
