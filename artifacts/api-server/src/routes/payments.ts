import { Router } from "express";
import axios from "axios";
import { db, paymentsTable, settingsTable, usersTable, plansTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

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

// ── Public: list active plans ────────────────────────────────────────────────

router.get("/plans", async (_req, res) => {
  const plans = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.isActive, true))
    .orderBy(asc(plansTable.sortOrder));
  res.json(plans);
});

// ── Config for upgrade page ──────────────────────────────────────────────────

router.get("/payments/config", requireAuth, async (req, res) => {
  const settings = await getSettings();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const countryCode = user.country?.toUpperCase().slice(0, 2) ?? "US";
  const currency = CURRENCY_MAP[countryCode] ?? "USD";

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
    plan: user.plan,
    planSlug: user.planSlug ?? null,
    planExpiresAt: user.planExpiresAt ?? null,
  });
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
      // Extract plan slug from reference (format: wxm_<slug>_<timestamp>_<userId>)
      // Fall back to metadata if present (future-proofing), then default to monthly
      const refParts = reference.split("_");
      const slugFromRef = refParts.length >= 2 ? refParts[1] : null;
      const validSlugs = ["weekly", "monthly", "quarterly", "biannual", "yearly"];
      const planSlug = data.metadata?.planSlug
        ?? (slugFromRef && validSlugs.includes(slugFromRef) ? slugFromRef : null)
        ?? "monthly";

      // Look up the plan to get duration
      const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, planSlug));
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

      // Update user
      await db.update(usersTable)
        .set({ plan: "pro", planSlug, planExpiresAt })
        .where(eq(usersTable.id, req.session.userId!));

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
    const planSlug = metadata?.planSlug ?? "monthly";

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
        .set({ plan: "pro", planSlug, planExpiresAt })
        .where(eq(usersTable.id, metadata.userId));
    }
  }

  res.json({ ok: true });
});

export { getSettings };
export default router;
