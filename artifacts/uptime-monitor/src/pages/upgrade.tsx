import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowRight, AlertCircle, Clock, Crown } from "lucide-react";
import { useEffect, useState } from "react";
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

export default function Upgrade() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const scriptLoaded = usePaystackScript();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<ApiPlan | null>(null); // plan awaiting a payment-method choice

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

  function startCheckout(plan: ApiPlan, channel: "card" | "mobile_money") {
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
      channels: [channel],
      onClose: () => setPaying(false),
      callback: (r) => {
        fetch(`${BASE}/api/payments/verify/${r.reference}`, { credentials: "include" })
          .then((res) => res.json())
          .then((data: { ok?: boolean; error?: string }) => {
            if (data.ok) {
              queryClient.invalidateQueries({ queryKey: ["auth-me"] });
              queryClient.invalidateQueries({ queryKey: ["pay-config"] });
              setLocation("/dashboard");
            } else {
              setError(data.error ?? "Payment verification failed. Contact support.");
              setPaying(false);
            }
          })
          .catch(() => { setError(`Could not verify payment. Ref: ${r.reference}`); setPaying(false); });
      },
    });
    handler.openIframe();
  }

  function onSelect(plan: ApiPlan) {
    setError("");
    if (plan.isFree || plan.slug === user?.planSlug) return;
    if (!config?.publicKey) { setError("Payments aren't configured yet — check back soon."); return; }
    if (config.userCountry === "KE") setPending(plan);
    else startCheckout(plan, "card");
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

  return (
    <Layout>
      <Helmet>
        <title>Plans &amp; Billing — GuardiX</title>
        <meta name="description" content="Choose the GuardiX plan that fits your monitoring needs." />
      </Helmet>

      {/* Payment method picker (Kenya) */}
      {pending && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70" onClick={() => setPending(null)}>
          <div className="bg-card border border-border rounded-lg p-8 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Choose payment method</p>
              <p className="font-display text-2xl text-foreground">{pending.name}</p>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                {symbol}{localPrice(pending.priceUsd).toLocaleString()} {currency} / {pending.billingInterval}
              </p>
            </div>
            <div className="space-y-3">
              <button onClick={() => startCheckout(pending, "mobile_money")}
                className="w-full flex items-center gap-4 p-4 border border-[#00A651]/40 bg-[#00A651]/5 hover:bg-[#00A651]/10 rounded-lg transition-colors group">
                <div className="w-10 h-10 rounded-full bg-[#00A651]/15 border border-[#00A651]/30 flex items-center justify-center shrink-0">
                  <span className="font-display text-base text-[#00A651]">M</span>
                </div>
                <div className="text-left">
                  <p className="font-mono text-sm font-bold text-foreground">M-Pesa STK Push</p>
                  <p className="font-mono text-[11px] text-muted-foreground">Prompt on your phone</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#00A651] ml-auto group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button onClick={() => startCheckout(pending, "card")}
                className="w-full flex items-center gap-4 p-4 border border-border hover:border-primary/50 bg-background rounded-lg transition-colors group">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <span className="text-sm">💳</span>
                </div>
                <div className="text-left">
                  <p className="font-mono text-sm font-bold text-foreground">Debit / Credit Card</p>
                  <p className="font-mono text-[11px] text-muted-foreground">Visa, Mastercard</p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary ml-auto group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <button onClick={() => setPending(null)} className="w-full mt-5 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
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

        {error && (
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
