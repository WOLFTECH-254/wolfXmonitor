import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Zap, CheckCircle2, ArrowRight, Crown, AlertCircle, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PayConfig {
  publicKey: string;
  currency: string;
  exchangeRate: number;
  freeLimit: number;
  userEmail: string;
  userName: string;
  plan: string;
  planSlug: string | null;
  planExpiresAt: string | null;
}

interface PlanOption {
  id: number;
  slug: string;
  name: string;
  durationDays: number;
  priceUsd: string;
  monitorLimit: number;
  isActive: boolean;
  sortOrder: number;
}

declare global {
  interface Window {
    PaystackPop?: {
      setup(opts: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata?: Record<string, unknown>;
        onClose: () => void;
        callback: (response: { reference: string }) => void;
      }): { openIframe(): void };
    };
  }
}

function usePaystackScript() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (window.PaystackPop) { setLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
    return () => { script.onload = null; };
  }, []);
  return loaded;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦", USD: "$", GHS: "GH₵", ZAR: "R", KES: "KSh",
  GBP: "£", EUR: "€", CAD: "CA$", AUD: "A$",
};

const PLAN_SAVINGS: Record<string, string> = {
  weekly: "",
  monthly: "",
  quarterly: "Save 11%",
  biannual: "Save 18%",
  yearly: "Save 27%",
};

function formatDuration(slug: string, durationDays: number): string {
  if (slug === "weekly") return "/ week";
  if (slug === "monthly") return "/ month";
  if (slug === "quarterly") return "/ 3 months";
  if (slug === "biannual") return "/ 6 months";
  if (slug === "yearly") return "/ year";
  return `/ ${durationDays} days`;
}

export default function Upgrade() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const scriptLoaded = usePaystackScript();
  const [selectedSlug, setSelectedSlug] = useState<string>("monthly");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const { data: config, isLoading: configLoading } = useQuery<PayConfig>({
    queryKey: ["pay-config"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/payments/config`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load pricing");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<PlanOption[]>({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/plans`);
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-sm text-muted-foreground mb-4">Sign in to upgrade your plan.</p>
          <Link href="/signin"><Button>Sign In</Button></Link>
        </div>
      </div>
    );
  }

  const symbol = CURRENCY_SYMBOLS[config?.currency ?? "USD"] ?? "$";
  const rate = config?.exchangeRate ?? 1;
  const alreadyPro = config?.plan === "pro";
  const isLoading = configLoading || plansLoading;

  const selectedPlan = plans.find((p) => p.slug === selectedSlug) ?? plans[0];

  function localPrice(priceUsd: string): number {
    const usd = parseFloat(priceUsd);
    return config?.currency === "USD" ? usd : Math.round(usd * rate);
  }

  function handleUpgrade() {
    if (!config || !scriptLoaded || !window.PaystackPop || !selectedPlan) {
      setError("Payment system not ready. Please refresh and try again.");
      return;
    }
    setError("");
    setPaying(true);

    const localAmt = localPrice(selectedPlan.priceUsd);
    const ref = `wxm_${selectedPlan.slug}_${Date.now()}_${user!.id}`;

    const handler = window.PaystackPop.setup({
      key: config.publicKey,
      email: config.userEmail,
      amount: localAmt * 100,
      currency: config.currency,
      ref,
      metadata: {
        userId: user!.id,
        planSlug: selectedPlan.slug,
        planName: selectedPlan.name,
      },
      onClose: () => { setPaying(false); },
      callback: async (response) => {
        setPaying(true);
        try {
          const res = await fetch(`${BASE}/api/payments/verify/${response.reference}`, { credentials: "include" });
          const data = await res.json() as { ok?: boolean; error?: string };
          if (data.ok) {
            queryClient.invalidateQueries({ queryKey: ["auth-me"] });
            queryClient.invalidateQueries({ queryKey: ["pay-config"] });
            setLocation("/dashboard");
          } else {
            setError(data.error ?? "Payment verification failed. Contact support.");
            setPaying(false);
          }
        } catch {
          setError("Could not verify payment. Contact support with ref: " + response.reference);
          setPaying(false);
        }
      },
    });
    handler.openIframe();
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 border-b border-border bg-background/95 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-xl tracking-wide">wolf<span className="text-primary">X</span>monitor</span>
        </Link>
        <Link href="/dashboard" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">← Dashboard</Link>
      </nav>

      <div className="pt-28 pb-20 px-6">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 font-mono text-xs text-primary uppercase tracking-widest border border-primary/25 bg-primary/5 px-3 py-1.5 rounded mb-6">
              <Crown className="w-3.5 h-3.5" /> Upgrade to Pro
            </div>
            <h1 className="font-display text-6xl md:text-8xl uppercase tracking-wide text-foreground leading-none mb-4">
              GO <span className="text-primary">PRO.</span>
            </h1>
            <p className="font-mono text-muted-foreground text-sm max-w-md mx-auto">
              Remove the monitor limit. Watch every service you run, 24/7.
            </p>
          </div>

          {/* Current plan info */}
          {alreadyPro && config?.planSlug && (
            <div className="max-w-2xl mx-auto mb-10">
              <div className="border border-primary/30 bg-primary/5 rounded p-5 flex items-center gap-4">
                <Clock className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <div className="font-mono text-sm text-primary font-bold">You're on Pro · {config.planSlug.charAt(0).toUpperCase() + config.planSlug.slice(1)} plan</div>
                  {config.planExpiresAt && (
                    <div className="font-mono text-xs text-muted-foreground mt-0.5">
                      Expires {formatDistanceToNow(new Date(config.planExpiresAt), { addSuffix: true })}
                    </div>
                  )}
                </div>
                <div className="ml-auto font-mono text-xs text-muted-foreground">Renew below to extend</div>
              </div>
            </div>
          )}

          {/* Two-column layout: plans left, summary right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">

            {/* Plan selector */}
            <div className="lg:col-span-2 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Choose a duration</p>

              {isLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="border border-border bg-card rounded p-4 animate-pulse h-20" />
                  ))}
                </div>
              ) : (
                plans.map((plan) => {
                  const local = localPrice(plan.priceUsd);
                  const savings = PLAN_SAVINGS[plan.slug];
                  const isSelected = selectedSlug === plan.slug;
                  return (
                    <button
                      key={plan.slug}
                      onClick={() => setSelectedSlug(plan.slug)}
                      className={`w-full text-left border rounded p-4 flex items-center justify-between transition-all group ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-primary" : "border-muted-foreground/40"}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <div className="font-mono text-sm font-bold text-foreground">{plan.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{formatDuration(plan.slug, plan.durationDays)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {savings && (
                          <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 border border-primary/25 px-2 py-0.5 rounded">
                            {savings}
                          </span>
                        )}
                        <div className="text-right">
                          <div className="font-display text-xl text-foreground leading-none">
                            {symbol}{local.toLocaleString()}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">{config?.currency ?? "USD"}</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Summary card */}
            <div className="lg:col-span-1">
              <div className="border border-primary bg-card rounded p-6 sticky top-24">
                <div className="absolute top-0 right-0 font-mono text-[10px] uppercase tracking-widest bg-primary text-primary-foreground px-3 py-1 rounded-bl">
                  {alreadyPro ? "Renew" : "Recommended"}
                </div>

                <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">Pro Plan</div>

                {selectedPlan && !isLoading ? (
                  <>
                    <div className="font-display text-4xl text-foreground leading-none mb-1">
                      {symbol}{localPrice(selectedPlan.priceUsd).toLocaleString()}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground mb-6">
                      {config?.currency ?? "USD"} · {selectedPlan.name}
                    </div>
                  </>
                ) : (
                  <div className="font-display text-4xl text-foreground leading-none mb-6 animate-pulse">—</div>
                )}

                <div className="space-y-2.5 mb-7">
                  {[
                    "Unlimited monitors",
                    "1–60 min ping intervals",
                    "Email alerts (down + recovery)",
                    "90-day ping history",
                    "Priority support",
                    config?.currency === "KES" ? "Pay via M-Pesa or card" : "Pay by card",
                  ].map(f => (
                    <div key={f} className="flex items-center gap-2.5 font-mono text-xs text-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" /> {f}
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 rounded px-3 py-2.5 mb-4 font-mono text-xs text-destructive">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
                  </div>
                )}

                <button
                  onClick={handleUpgrade}
                  disabled={paying || isLoading || !config?.publicKey || !selectedPlan}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded bg-primary text-primary-foreground font-mono text-sm font-bold tracking-wider hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                >
                  {paying ? "Processing…" : alreadyPro ? "Renew Pro" : "Pay Now"}
                  {!paying && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                </button>

                {!config?.publicKey && !isLoading && (
                  <p className="font-mono text-[10px] text-muted-foreground text-center mt-2">Payment not yet configured by admin.</p>
                )}

                <p className="font-mono text-[10px] text-muted-foreground text-center mt-3">
                  Secure payment via Paystack · No subscription
                </p>
              </div>
            </div>
          </div>

          {/* Free vs Pro comparison */}
          <div className="max-w-2xl mx-auto mt-14">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 text-center">Free vs Pro</p>
            <div className="border border-border bg-card rounded overflow-hidden">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Feature</th>
                    <th className="px-5 py-3 text-center text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Free</th>
                    <th className="px-5 py-3 text-center text-[10px] uppercase tracking-widest text-primary font-normal">Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Monitors", `Up to ${config?.freeLimit ?? 5}`, "Unlimited"],
                    ["Ping intervals", "1–60 min", "1–60 min"],
                    ["Email alerts", "✓", "✓"],
                    ["Ping history", "90 days", "90 days"],
                    ["Priority support", "—", "✓"],
                    ["STK Push (Kenya)", "—", "✓"],
                  ].map(([feat, free, pro]) => (
                    <tr key={feat} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-muted-foreground">{feat}</td>
                      <td className="px-5 py-3 text-center text-muted-foreground/70">{free}</td>
                      <td className="px-5 py-3 text-center text-primary font-bold">{pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
