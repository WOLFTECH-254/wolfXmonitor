import { Check, X, Crown } from "lucide-react";
import {
  monitorsLabel, intervalLabel, retentionLabel, statusPagesLabel, teamLabel,
} from "@/lib/plan-format";

export interface ApiPlan {
  slug: string;
  name: string;
  description: string;
  priceUsd: number;
  currency: string;
  billingInterval: string;
  durationDays: number;
  monitorLimit: number;
  checkIntervalSeconds: number;
  retentionDays: number;
  statusPageLimit: number;
  teamMemberLimit: number;
  features: {
    emailAlerts: boolean;
    webhookAlerts: boolean;
    telegramAlerts: boolean;
    sslMonitoring: boolean;
  };
  isFree: boolean;
  isUnlimited: boolean;
  isPopular: boolean;
  sortOrder: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", NGN: "₦", KES: "KSh", GHS: "GH₵", ZAR: "R", GBP: "£", EUR: "€", CAD: "CA$", AUD: "A$",
};

const BILLING_LABELS: Record<string, string> = {
  monthly: "month", yearly: "year", weekly: "week", daily: "day", quarterly: "quarter",
};

function billingLabel(interval: string): string {
  return BILLING_LABELS[interval] ?? interval.replace(/ly$/, "");
}

function formatPrice(usd: number, currency = "USD", rate = 1): string {
  if (usd === 0) return currency === "USD" ? "$0" : `${CURRENCY_SYMBOLS[currency] ?? ""}0`;
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const amount = currency === "USD" ? usd : Math.round(usd * rate);
  return `${sym}${amount.toLocaleString(undefined, { maximumFractionDigits: currency === "USD" ? 2 : 0 })}`;
}

function Feat({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-start gap-2 font-mono text-xs ${ok ? "text-foreground" : "text-muted-foreground/50"}`}>
      {ok ? <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> : <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
      <span>{children}</span>
    </li>
  );
}

export function PlanCards({
  plans,
  currentSlug,
  onSelect,
  ctaLabel = "Choose plan",
  currency = "USD",
  rate = 1,
  billingSuffix,
}: {
  plans: ApiPlan[];
  currentSlug?: string | null;
  onSelect?: (plan: ApiPlan) => void;
  ctaLabel?: string;
  currency?: string;
  rate?: number;
  billingSuffix?: string;
}) {
  const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {sorted.map((p) => {
        const isCurrent = currentSlug === p.slug;
        return (
          <div
            key={p.slug}
            className={`relative flex flex-col rounded-lg border p-5 transition-colors ${
              p.isPopular ? "border-primary/50 bg-primary/[0.04]" : "border-border bg-card"
            }`}
          >
            {p.isPopular && (
              <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                <Crown className="w-3 h-3" /> Popular
              </span>
            )}
            <div className="font-display text-xl text-foreground">{p.name}</div>
            <p className="font-mono text-[11px] text-muted-foreground mt-1 min-h-[2.5em]">{p.description}</p>

            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-3xl text-foreground">{formatPrice(p.priceUsd, currency, rate)}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {billingSuffix ?? `/ ${billingLabel(p.billingInterval)}`}
              </span>
            </div>

            <ul className="mt-4 space-y-1.5 flex-1">
              <Feat ok>{monitorsLabel(p.monitorLimit)}</Feat>
              <Feat ok>{intervalLabel(p.checkIntervalSeconds)}</Feat>
              <Feat ok>{retentionLabel(p.retentionDays)}</Feat>
              <Feat ok={p.statusPageLimit !== 0}>{statusPagesLabel(p.statusPageLimit)}</Feat>
              <Feat ok={p.teamMemberLimit > 1 || p.teamMemberLimit < 0}>{teamLabel(p.teamMemberLimit)}</Feat>
              <Feat ok={p.features.emailAlerts}>Email alerts</Feat>
              <Feat ok={p.features.webhookAlerts}>Webhook &amp; Discord alerts</Feat>
              <Feat ok={p.features.telegramAlerts}>Telegram alerts</Feat>
              <Feat ok={p.features.sslMonitoring}>SSL certificate monitoring</Feat>
            </ul>

            <button
              onClick={() => onSelect?.(p)}
              disabled={isCurrent || !onSelect}
              className={`mt-5 w-full rounded-md py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
                isCurrent
                  ? "border border-border text-muted-foreground cursor-default"
                  : p.isPopular
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border border-primary/40 text-primary hover:bg-primary/10"
              }`}
            >
              {isCurrent ? "Current plan" : p.isFree ? "Get started free" : ctaLabel}
            </button>
          </div>
        );
      })}
    </div>
  );
}
