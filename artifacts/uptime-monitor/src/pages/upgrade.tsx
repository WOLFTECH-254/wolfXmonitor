import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowRight, AlertCircle, Clock, Crown, Loader2, Smartphone, CreditCard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout";
import { PlanCards, type ApiPlan } from "@/components/plan-cards";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PayConfig {
  publicKey: string;
  currency: string;
  exchangeRate: number;
  userEmail: string;
  userCountry: string;
  planSlug: string | null;
  planExpiresAt: string | null;
}

declare global {
  interface Window {
    PaystackPop?: {
      setup(opts: {
        key: string; email: string; amount: number; currency: string; ref: string;
        channels?: string[]; onClose: () => void; callback: (r: { reference: string }) => void;
      }): { openIframe(): void };
    };
  }
}

function usePaystackScript() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (window.PaystackPop) { setLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
    return () => { s.onload = null; };
  }, []);
  return loaded;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦", USD: "$", GHS: "GH₵", ZAR: "R", KES: "KSh", GBP: "£", EUR: "€", CAD: "CA$", AUD: "A$",
};

type Mode = "method" | "mpesa" | "waiting";

export default function Upgrade() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const scriptLoaded = usePaystackScript();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  // Payment-method flow
  const [pending, setPending] = useState<ApiPlan | null>(null);
  const [mode, setMode] = useState<Mode>("method");
  const [phone, setPhone] = useState("");
  const [mpesaBusy, setMpesaBusy] = useState(false);
  const [mpesaHint, setMpesaHint] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  const closeModal = () => {
    stopPolling();
    setPending(null);
    setMode("method");
    setPhone("");
    setMpesaBusy(false);
    setMpesaHint("");
  };
  useEffect(() => () => stopPolling(), []);

  const { data: config } = useQuery<PayConfig>({
    queryKey: ["pay-config"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/payments/config`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load pricing");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: plans = [], isLoading } = useQuery<ApiPlan[]>({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/plans`);
      return res.ok ? res.json() : [];
    },
  });

  const currency = config?.currency ?? "USD";
  const rate = config?.exchangeRate ?? 1;
  const symbol = CURRENCY_SYMBOLS[currency] ?? "$";
  const localPrice = (usd: number) => (currency === "USD" ? usd : Math.round(usd * rate));

  function onPaid(reference: string) {
    queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    queryClient.invalidateQueries({ queryKey: ["pay-config"] });
    void reference;
    closeModal();
    setPaying(false);
    setLocation("/dashboard");
  }

  // ── Card: Paystack inline popup ──────────────────────────────────────────
  function startCardCheckout(plan: ApiPlan) {
    if (!config || !scriptLoaded || !window.PaystackPop) {
      setError("Payment system isn't ready — refresh and try again.");
      return;
    }
    setPending(null);
    setPaying(true);
    setError("");
    const ref = `wxm_${plan.slug}_${Date.now()}_${user!.id}`;
    const handler = window.PaystackPop.setup({
      key: config.publicKey,
      email: config.userEmail,
      amount: localPrice(plan.priceUsd) * 100,
      currency,
      ref,
      channels: ["card"],
      onClose: () => setPaying(false),
      callback: (r) => {
        fetch(`${BASE}/api/payments/verify/${r.reference}`, { credentials: "include" })
          .then((res) => res.json())
          .then((data: { ok?: boolean; error?: string }) => {
            if (data.ok) onPaid(r.reference);
            else { setError(data.error ?? "Payment verification failed. Contact support."); setPaying(false); }
          })
          .catch(() => { setError(`Could not verify payment. Ref: ${r.reference}`); setPaying(false); });
      },
    });
    handler.openIframe();
  }

  // ── M-Pesa: STK push, then poll our verify endpoint ──────────────────────
  async function startMpesa(plan: ApiPlan) {
    setError("");
    setMpesaHint("");
    setMpesaBusy(true);
    try {
      const res = await fetch(`${BASE}/api/payments/charge/mpesa`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planSlug: plan.slug, phone }),
      });
      const data = (await res.json()) as { reference?: string; displayText?: string; error?: string };
      if (!res.ok || !data.reference) {
        setMpesaHint("");
        setError(data.error ?? "Could not start the M-Pesa payment.");
        setMpesaBusy(false);
        return;
      }
      setMode("waiting");
      setMpesaHint(data.displayText ?? "Check your phone for the M-Pesa prompt.");
      pollVerify(data.reference);
    } catch {
      setError("Network error starting M-Pesa payment.");
      setMpesaBusy(false);
    }
  }

  function pollVerify(reference: string) {
    stopPolling();
    let tries = 0;
    const MAX = 40; // ~40 × 5s ≈ 3.5 min
    pollRef.current = setInterval(async () => {
      tries += 1;
      try {
        const res = await fetch(`${BASE}/api/payments/verify/${reference}`, { credentials: "include" });
        const data = (await res.json()) as { ok?: boolean; status?: string; error?: string };
        if (data.ok) { onPaid(reference); return; }
        if (data.status === "failed" || data.status === "abandoned" || data.status === "reversed") {
          stopPolling();
          setMode("mpesa");
          setMpesaBusy(false);
          setError("The M-Pesa payment didn't go through. Try again.");
          return;
        }
      } catch { /* keep polling */ }
      if (tries >= MAX) {
        stopPolling();
        setMode("mpesa");
        setMpesaBusy(false);
        setError("We didn't get confirmation in time. If you were charged, contact support.");
      }
    }, 5000);
  }

  function onSelect(plan: ApiPlan) {
    setError("");
    if (plan.isFree || plan.slug === user?.planSlug) return;
    if (!config?.publicKey) { setError("Payments aren't configured yet — check back soon."); return; }
    setPending(plan);
    setMode("method");
    setPhone("");
    setMpesaHint("");
    setMpesaBusy(false);
  }

  // Deep link from the pricing page: /upgrade?plan=pro
  useEffect(() => {
    const slug = new URLSearchParams(search).get("plan");
    if (slug && plans.length && config) {
      const p = plans.find((x) => x.slug === slug);
      if (p && !p.isFree && p.slug !== user?.planSlug) onSelect(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, plans, config]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-sm text-muted-foreground mb-4">Sign in to change your plan.</p>
          <Link href="/signin"><Button>Sign In</Button></Link>
        </div>
      </div>
    );
  }

  const currentPlan = plans.find((p) => p.slug === user.planSlug);
  const priceLine = pending
    ? `${symbol}${localPrice(pending.priceUsd).toLocaleString()} ${currency} / ${pending.billingInterval.replace(/ly$/, "")}`
    : "";

  return (
    <Layout>
      <Helmet>
        <title>Plans &amp; Billing — GuardiX</title>
        <meta name="description" content="Choose the GuardiX plan that fits your monitoring needs." />
      </Helmet>

      {/* Payment modal */}
      {pending && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
          onClick={mode === "waiting" ? undefined : closeModal}
        >
          <div className="bg-card border border-border rounded-lg p-8 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
                {mode === "method" ? "Choose payment method" : mode === "mpesa" ? "Pay with M-Pesa" : "Waiting for M-Pesa"}
              </p>
              <p className="font-display text-2xl text-foreground">{pending.name}</p>
              <p className="font-mono text-xs text-muted-foreground mt-1">{priceLine}</p>
            </div>

            {mode === "method" && (
              <div className="space-y-3">
                <button
                  onClick={() => { setMode("mpesa"); setError(""); }}
                  className="w-full flex items-center gap-4 p-4 border border-[#00A651]/40 bg-[#00A651]/5 hover:bg-[#00A651]/10 rounded-lg transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#00A651]/15 border border-[#00A651]/30 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4 text-[#00A651]" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-mono text-sm font-bold text-foreground">M-Pesa</p>
                    <p className="font-mono text-[11px] text-muted-foreground">STK push to your phone</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#00A651] group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button
                  onClick={() => startCardCheckout(pending)}
                  className="w-full flex items-center gap-4 p-4 border border-border hover:border-primary/50 bg-background rounded-lg transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-mono text-sm font-bold text-foreground">Debit / Credit Card</p>
                    <p className="font-mono text-[11px] text-muted-foreground">Visa, Mastercard</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button onClick={closeModal} className="w-full mt-2 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>
            )}

            {mode === "mpesa" && (
              <form
                onSubmit={(e) => { e.preventDefault(); if (!mpesaBusy) startMpesa(pending); }}
                className="space-y-4"
              >
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Safaricom number</label>
                  <input
                    autoFocus
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712 345 678"
                    className="mt-1.5 w-full bg-background border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                  <p className="font-mono text-[10px] text-muted-foreground mt-1.5">
                    You'll get a prompt to enter your M-Pesa PIN. No card popup.
                  </p>
                </div>
                {error && (
                  <div className="flex items-start gap-2 font-mono text-[11px] text-destructive">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setMode("method"); setError(""); }}
                    className="font-mono text-xs text-muted-foreground hover:text-foreground px-3 py-2"
                  >
                    Back
                  </button>
                  <Button type="submit" className="flex-1 font-mono text-xs" disabled={mpesaBusy || phone.trim().length < 9}>
                    {mpesaBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Send STK push"}
                  </Button>
                </div>
              </form>
            )}

            {mode === "waiting" && (
              <div className="text-center space-y-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{mpesaHint}</p>
                <p className="font-mono text-[10px] text-muted-foreground/70">
                  Keep this open — it updates automatically once you approve on your phone.
                </p>
                <button onClick={closeModal} className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  Cancel and check later
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 font-mono text-xs text-primary uppercase tracking-widest border border-primary/25 bg-primary/5 px-3 py-1.5 rounded mb-5">
            <Crown className="w-3.5 h-3.5" /> Plans &amp; Billing
          </div>
          <h1 className="font-display text-[clamp(30px,5vw,52px)] text-foreground leading-tight">
            {currentPlan ? <>You're on the <span className="text-primary">{currentPlan.name}</span> plan</> : "Choose your plan"}
          </h1>
        </div>

        {user.overLimit && (
          <div className="max-w-2xl mx-auto border border-yellow-500/40 bg-yellow-500/5 rounded p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="font-mono text-xs text-yellow-200/90 leading-relaxed">
              Your account is above your current plan's limits. Existing monitors keep running, but you can't add
              new ones until you remove some or upgrade.
            </p>
          </div>
        )}

        {config?.planExpiresAt && user.planSlug !== "free" && (
          <div className="max-w-2xl mx-auto border border-primary/30 bg-primary/5 rounded p-4 flex items-center gap-3">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <p className="font-mono text-xs text-muted-foreground">
              Renews / expires {formatDistanceToNow(new Date(config.planExpiresAt), { addSuffix: true })}.
              Pick the same plan again to extend.
            </p>
          </div>
        )}

        {error && !pending && (
          <div className="max-w-2xl mx-auto flex items-start gap-2 border border-destructive/30 bg-destructive/5 rounded px-3 py-2.5 font-mono text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => <div key={i} className="h-96 rounded-lg border border-border bg-card animate-pulse" />)}
          </div>
        ) : (
          <PlanCards
            plans={plans}
            currentSlug={user.planSlug}
            onSelect={paying ? undefined : onSelect}
            ctaLabel={paying ? "Processing…" : "Choose plan"}
            currency={currency}
            rate={rate}
          />
        )}

        {!config?.publicKey && !isLoading && (
          <p className="font-mono text-[11px] text-muted-foreground text-center">
            Paid plans require the admin to configure Paystack. Free is available now.
          </p>
        )}
        <p className="font-mono text-[10px] text-muted-foreground/60 text-center">
          Secure payment via Paystack · prices billed in {currency}
        </p>
      </div>
    </Layout>
  );
}
