import { Router } from "express";
import axios from "axios";
import { db, paymentsTable, settingsTable, usersTable, monitorsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
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
    priceUsd: Number(map.get("plan_price_usd") ?? "10"),
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

router.get("/payments/config", requireAuth, async (req, res) => {
  const settings = await getSettings();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const countryCode = user.country?.toUpperCase().slice(0, 2) ?? "US";
  const currency = CURRENCY_MAP[countryCode] ?? "USD";

  let price = settings.priceUsd;
  let displayAmount = settings.priceUsd;

  if (currency !== "USD") {
    const rates = await getExchangeRates();
    const rate = rates[currency];
    if (rate) {
      displayAmount = Math.round(settings.priceUsd * rate);
      price = displayAmount;
    }
  }

  res.json({
    publicKey: settings.publicKey,
    currency,
    amount: price * 100,
    displayAmount,
    priceUsd: settings.priceUsd,
    userEmail: user.email,
    userName: user.name,
    plan: user.plan,
    freeLimit: settings.freeLimit,
  });
});

router.post("/payments/initialize", requireAuth, async (req, res) => {
  const settings = await getSettings();
  if (!settings.secretKey) {
    res.status(400).json({ error: "Paystack not configured." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.plan === "pro") { res.status(400).json({ error: "Already on Pro plan." }); return; }

  const countryCode = user.country?.toUpperCase().slice(0, 2) ?? "US";
  const currency = CURRENCY_MAP[countryCode] ?? "USD";

  let amountMinor = settings.priceUsd * 100;
  if (currency !== "USD") {
    const rates = await getExchangeRates();
    const rate = rates[currency];
    if (rate) amountMinor = Math.round(settings.priceUsd * rate) * 100;
  }

  const reference = `wxm_${Date.now()}_${user.id}`;

  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      { email: user.email, amount: amountMinor, currency, reference, metadata: { userId: user.id, plan: "pro" } },
      { headers: { Authorization: `Bearer ${settings.secretKey}`, "Content-Type": "application/json" } }
    );

    await db.insert(paymentsTable).values({
      userId: user.id,
      paystackReference: reference,
      amount: amountMinor,
      currency,
      status: "pending",
      plan: "pro",
    });

    res.json({ authorizationUrl: (response.data as { data: { authorization_url: string } }).data.authorization_url, reference });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Paystack error: ${msg}` });
  }
});

router.get("/payments/verify/:reference", requireAuth, async (req, res) => {
  const { reference } = req.params;
  const settings = await getSettings();

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${settings.secretKey}` } }
    );

    const data = (response.data as { data: { status: string; metadata?: { userId?: number } } }).data;

    if (data.status === "success") {
      await db.update(paymentsTable).set({ status: "success" }).where(eq(paymentsTable.paystackReference, reference));
      await db.update(usersTable).set({ plan: "pro" }).where(eq(usersTable.id, req.session.userId!));
      res.json({ ok: true, plan: "pro" });
    } else {
      await db.update(paymentsTable).set({ status: data.status }).where(eq(paymentsTable.paystackReference, reference));
      res.json({ ok: false, status: data.status });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Verification error: ${msg}` });
  }
});

router.post("/payments/webhook", async (req, res) => {
  const settings = await getSettings();
  const event = req.body as { event?: string; data?: { reference?: string; status?: string; metadata?: { userId?: number } } };

  if (event.event === "charge.success" && event.data?.reference) {
    const { reference, metadata } = event.data;
    await db.update(paymentsTable).set({ status: "success" }).where(eq(paymentsTable.paystackReference, reference));
    if (metadata?.userId) {
      await db.update(usersTable).set({ plan: "pro" }).where(eq(usersTable.id, metadata.userId));
    }
  }

  res.json({ ok: true });
});

export { getSettings };
export default router;
