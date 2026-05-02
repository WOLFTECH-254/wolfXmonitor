import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Zap, CheckCircle2, ArrowRight, Crown, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PayConfig {
  publicKey: string; currency: string; amount: number;
  displayAmount: number; priceUsd: number; userEmail: string;
  userName: string; plan: string; freeLimit: number;
}

declare global {
  interface Window {
    PaystackPop?: {
      setup(opts: {
        key: string; email: string; amount: number; currency: string;
        ref: string; onClose: () => void;
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

export default function Upgrade() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const scriptLoaded = usePaystackScript();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const { data: config, isLoading } = useQuery<PayConfig>({
    queryKey: ["pay-config"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/payments/config`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load pricing");
      return res.json();
    },
    enabled: !!user,
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
  const alreadyPro = config?.plan === "pro";

  function handleUpgrade() {
    if (!config || !scriptLoaded || !window.PaystackPop) {
      setError("Payment system not ready. Please refresh and try again.");
      return;
    }
    setError("");
    setPaying(true);

    const ref = `wxm_${Date.now()}_${user!.id}`;
    const handler = window.PaystackPop.setup({
      key: config.publicKey,
      email: config.userEmail,
      amount: config.amount,
      currency: config.currency,
      ref,
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
          setError("Could not verify payment. Contact support with your reference: " + response.reference);
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

      <div className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 font-mono text-xs text-primary uppercase tracking-widest border border-primary/25 bg-primary/5 px-3 py-1.5 rounded mb-6">
              <Crown className="w-3.5 h-3.5" /> Upgrade Plan
            </div>
            <h1 className="font-display text-6xl md:text-8xl uppercase tracking-wide text-foreground leading-none mb-4">
              GO <span className="text-primary">PRO.</span>
            </h1>
            <p className="font-mono text-muted-foreground text-sm max-w-md mx-auto">
              Remove the monitor limit. Watch every service you run, forever.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Free plan */}
            <div className="border border-border bg-card rounded p-8">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Free</div>
              <div className="font-display text-5xl text-foreground leading-none mb-6">$0</div>
              <div className="space-y-3 mb-8">
                {[
                  `Up to ${config?.freeLimit ?? 5} monitors`,
                  "1–60 min ping intervals",
                  "Email alerts (down + recovery)",
                  "90-day ping history",
                ].map(f => (
                  <div key={f} className="flex items-center gap-2.5 font-mono text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" /> {f}
                  </div>
                ))}
              </div>
              {alreadyPro ? (
                <div className="w-full py-3 rounded border border-border font-mono text-xs text-muted-foreground text-center">Current plan</div>
              ) : (
                <div className="w-full py-3 rounded border border-border font-mono text-xs text-primary text-center font-bold">Current plan</div>
              )}
            </div>

            {/* Pro plan */}
            <div className={`border rounded p-8 relative overflow-hidden ${alreadyPro ? "border-primary/40 bg-primary/5" : "border-primary bg-card"}`}>
              <div className="absolute top-0 right-0 font-mono text-[10px] uppercase tracking-widest bg-primary text-primary-foreground px-3 py-1 rounded-bl">
                {alreadyPro ? "Active" : "Recommended"}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">Pro</div>
              {isLoading ? (
                <div className="font-display text-5xl text-foreground leading-none mb-1 animate-pulse">—</div>
              ) : (
                <>
                  <div className="font-display text-5xl text-foreground leading-none mb-1">
                    {symbol}{config?.displayAmount?.toLocaleString() ?? "—"}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground mb-6">
                    {config?.currency} · one-time
                  </div>
                </>
              )}
              <div className="space-y-3 mb-8">
                {[
                  "Unlimited monitors",
                  "1–60 min ping intervals",
                  "Email alerts (down + recovery)",
                  "90-day ping history",
                  "Priority support",
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

              {alreadyPro ? (
                <div className="w-full py-3.5 rounded border border-primary/40 font-mono text-xs text-primary text-center font-bold">
                  ✓ You're on Pro
                </div>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={paying || isLoading || !config?.publicKey}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded bg-primary text-primary-foreground font-mono text-sm font-bold tracking-wider hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                >
                  {paying ? "Processing…" : "Upgrade Now"}
                  {!paying && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                </button>
              )}
              {!config?.publicKey && !isLoading && (
                <p className="font-mono text-[10px] text-muted-foreground text-center mt-2">Payment not yet configured by admin.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
