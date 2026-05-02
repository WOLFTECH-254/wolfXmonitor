import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Users, Server, Trash2, Pause, Play, ShieldCheck, RefreshCw, CheckCircle2, XCircle, Mail, Eye, EyeOff, Send, CreditCard, Settings, Crown, Twitter, Instagram, Facebook, Linkedin, Youtube, Shield, Ban, AlertTriangle, CheckCheck } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria", GH: "Ghana", KE: "Kenya", ZA: "South Africa",
  US: "United States", GB: "United Kingdom", CA: "Canada", AU: "Australia",
  DE: "Germany", FR: "France", IN: "India", BR: "Brazil",
  MX: "Mexico", JP: "Japan", SG: "Singapore", AE: "UAE",
  RW: "Rwanda", TZ: "Tanzania", UG: "Uganda", ET: "Ethiopia",
  EG: "Egypt", MA: "Morocco", SN: "Senegal",
};

function countryFlag(code?: string | null): string {
  if (!code || code.length !== 2 || code === "OT") return "🌍";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

interface AdminStats { totalUsers: number; totalMonitors: number; totalPings: number; monitorsUp: number; monitorsDown: number; monitorsUnknown: number; globalUptime: number; }
interface AdminUser { id: number; name: string; email: string; isAdmin: boolean; notificationsEnabled: boolean; monitorCount: number; createdAt: string; plan?: string; country?: string; }
interface AdminMonitor { id: number; name: string; url: string; intervalMinutes: number; active: boolean; lastStatus: string; lastPingedAt: string | null; lastResponseTimeMs: number | null; userId: number | null; userName: string | null; userEmail: string | null; createdAt: string; }
interface ActivityEntry { id: number; status: string; responseTimeMs: number | null; statusCode: number | null; error: string | null; createdAt: string; monitorId: number | null; monitorName: string | null; monitorUrl: string | null; userName: string | null; }
interface EmailSettings { brevoApiKeySet: boolean; brevoApiKeyMasked: string; senderEmail: string; senderName: string; }
interface BillingSettings { paystackSecretKeySet: boolean; paystackSecretKeyMasked: string; paystackPublicKey: string; paystackCurrency: string; freeMonitorLimit: number; }
interface PaymentRow { id: number; paystackReference: string; amount: number; currency: string; status: string; plan: string; createdAt: string; userId: number | null; userName: string | null; userEmail: string | null; }
interface AdminPlan { id: number; slug: string; name: string; durationDays: number; priceUsd: string; monitorLimit: number; isActive: boolean; sortOrder: number; }
interface SecurityEvent { id: number; type: string; ip: string; path: string | null; method: string | null; userAgent: string | null; details: string | null; resolved: boolean; createdAt: string; }
interface BlockedIp { id: number; ip: string; reason: string | null; blockedBy: number | null; createdAt: string; }
interface SecurityStats { total: number; unresolved: number; blocked: number; byType: Record<string, number>; }

type Tab = "overview" | "monitors" | "users" | "activity" | "payments" | "settings" | "security";

// ── Email Settings ────────────────────────────────────────────────────────────
function EmailSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [brevoApiKey, setBrevoApiKey] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [testError, setTestError] = useState("");

  const { data: s } = useQuery<EmailSettings>({
    queryKey: ["admin-email-settings"],
    queryFn: () => apiFetch("/api/admin/settings/email"),
  });

  useEffect(() => {
    if (s) {
      setSenderEmail(s.senderEmail);
      setSenderName(s.senderName);
      if (s.brevoApiKeySet && !brevoApiKey) setBrevoApiKey(s.brevoApiKeyMasked);
    }
  }, [s]);

  const save = useMutation({
    mutationFn: () => apiFetch("/api/admin/settings/email", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ brevoApiKey, senderEmail, senderName }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-email-settings"] }); toast({ title: "Email settings saved" }); },
    onError: () => toast({ variant: "destructive", title: "Failed to save" }),
  });

  const testConnection = async () => {
    setTestStatus("sending"); setTestError("");
    try {
      const res = await fetch(`${BASE}/api/admin/settings/email/test`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" } });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setTestStatus("error"); setTestError(data.error ?? "Unknown error"); }
      else { setTestStatus("ok"); toast({ title: "Test email sent!" }); }
    } catch (e) { setTestStatus("error"); setTestError(String(e)); }
    setTimeout(() => setTestStatus("idle"), 6000);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-display text-2xl uppercase tracking-wide text-foreground">Brevo / Email</h3>
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">API Key</label>
          <div className="relative">
            <input type={showKey ? "text" : "password"} value={brevoApiKey} onChange={(e) => setBrevoApiKey(e.target.value)}
              onFocus={() => { if (brevoApiKey === s?.brevoApiKeyMasked) setBrevoApiKey(""); }}
              onBlur={() => { if (!brevoApiKey && s?.brevoApiKeySet) setBrevoApiKey(s.brevoApiKeyMasked); }}
              placeholder="xkeysib-…"
              className="w-full bg-background border border-border rounded px-3 py-2.5 pr-10 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
            <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {s?.brevoApiKeySet && <p className="font-mono text-[10px] text-primary">✓ Key configured</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sender Name</label>
            <input type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="wolfXmonitor"
              className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sender Email</label>
            <input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="alerts@yourdomain.com"
              className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="font-mono text-xs uppercase tracking-widest">
            {save.isPending ? "Saving…" : "Save Email Settings"}
          </Button>
          <Button variant="outline" onClick={testConnection} disabled={testStatus === "sending" || !s?.brevoApiKeySet} className="font-mono text-xs uppercase tracking-widest flex items-center gap-2">
            <Send className="w-3.5 h-3.5" />
            {testStatus === "sending" ? "Sending…" : "Test Connection"}
          </Button>
        </div>
        {testStatus === "ok" && <div className="flex items-center gap-2 font-mono text-xs text-primary border border-primary/25 bg-primary/5 rounded px-3 py-2"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" />Test email sent — check your inbox.</div>}
        {testStatus === "error" && <div className="font-mono text-xs text-destructive border border-destructive/25 bg-destructive/5 rounded px-3 py-2"><div className="flex items-center gap-2 mb-1"><XCircle className="w-3.5 h-3.5 shrink-0" />Connection failed</div><div className="pl-5 text-destructive/70">{testError}</div></div>}
      </div>
    </div>
  );
}

// ── Billing Settings ──────────────────────────────────────────────────────────
function BillingSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [secretKey, setSecretKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [freeLimit, setFreeLimit] = useState("");

  const { data: s } = useQuery<BillingSettings>({
    queryKey: ["admin-billing-settings"],
    queryFn: () => apiFetch("/api/admin/settings/billing"),
  });

  useEffect(() => {
    if (s) {
      setPublicKey(s.paystackPublicKey);
      setCurrency(s.paystackCurrency || "KES");
      setFreeLimit(String(s.freeMonitorLimit));
      if (s.paystackSecretKeySet && !secretKey) setSecretKey(s.paystackSecretKeyMasked);
    }
  }, [s]);

  const save = useMutation({
    mutationFn: () => apiFetch("/api/admin/settings/billing", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ paystackSecretKey: secretKey, paystackPublicKey: publicKey, paystackCurrency: currency, freeMonitorLimit: Number(freeLimit) }),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-billing-settings"] }); toast({ title: "Billing settings saved" }); },
    onError: () => toast({ variant: "destructive", title: "Failed to save" }),
  });

  return (
    <div className="space-y-4">
      <h3 className="font-display text-2xl uppercase tracking-wide text-foreground">Paystack / Billing</h3>
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Secret Key (server-side)</label>
          <div className="relative">
            <input type={showSecret ? "text" : "password"} value={secretKey} onChange={(e) => setSecretKey(e.target.value)}
              onFocus={() => { if (secretKey === s?.paystackSecretKeyMasked) setSecretKey(""); }}
              onBlur={() => { if (!secretKey && s?.paystackSecretKeySet) setSecretKey(s.paystackSecretKeyMasked); }}
              placeholder="sk_live_…"
              className="w-full bg-background border border-border rounded px-3 py-2.5 pr-10 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
            <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {s?.paystackSecretKeySet && <p className="font-mono text-[10px] text-primary">✓ Secret key configured</p>}
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Public Key (client-side)</label>
          <input type="text" value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="pk_live_…"
            className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Paystack Account Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:border-primary transition-colors">
              <option value="NGN">NGN — Nigerian Naira</option>
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="GHS">GHS — Ghanaian Cedi</option>
              <option value="ZAR">ZAR — South African Rand</option>
              <option value="USD">USD — US Dollar</option>
              <option value="GBP">GBP — British Pound</option>
            </select>
            <p className="font-mono text-[10px] text-muted-foreground">Must match your Paystack account's supported currency.</p>
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Free Monitor Limit</label>
            <input type="number" min="1" value={freeLimit} onChange={(e) => setFreeLimit(e.target.value)} placeholder="5"
              className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
            <p className="font-mono text-[10px] text-muted-foreground">Max monitors on Free plan.</p>
          </div>
        </div>
        <div>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="font-mono text-xs uppercase tracking-widest">
            {save.isPending ? "Saving…" : "Save Billing Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Footer / Site Settings ────────────────────────────────────────────────────
interface SiteSettings { twitterUrl: string; instagramUrl: string; facebookUrl: string; linkedinUrl: string; youtubeUrl: string; privacyUrl: string; termsUrl: string; tagline: string; }

function FooterSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [twitterUrl, setTwitterUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [termsUrl, setTermsUrl] = useState("");
  const [tagline, setTagline] = useState("");

  const { data } = useQuery<SiteSettings>({ queryKey: ["admin-site-settings"], queryFn: () => apiFetch("/api/admin/settings/site") });

  useEffect(() => {
    if (data) {
      setTwitterUrl(data.twitterUrl ?? "");
      setInstagramUrl(data.instagramUrl ?? "");
      setFacebookUrl(data.facebookUrl ?? "");
      setLinkedinUrl(data.linkedinUrl ?? "");
      setYoutubeUrl(data.youtubeUrl ?? "");
      setPrivacyUrl(data.privacyUrl ?? "");
      setTermsUrl(data.termsUrl ?? "");
      setTagline(data.tagline ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiFetch("/api/admin/settings/site", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ twitterUrl, instagramUrl, facebookUrl, linkedinUrl, youtubeUrl, privacyUrl, termsUrl, tagline }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-site-settings"] });
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "Footer settings saved" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to save" }),
  });

  const SOCIAL_FIELDS = [
    { label: "Twitter / X URL", value: twitterUrl, setter: setTwitterUrl, Icon: Twitter, placeholder: "https://twitter.com/yourhandle" },
    { label: "Instagram URL", value: instagramUrl, setter: setInstagramUrl, Icon: Instagram, placeholder: "https://instagram.com/yourhandle" },
    { label: "Facebook URL", value: facebookUrl, setter: setFacebookUrl, Icon: Facebook, placeholder: "https://facebook.com/yourpage" },
    { label: "LinkedIn URL", value: linkedinUrl, setter: setLinkedinUrl, Icon: Linkedin, placeholder: "https://linkedin.com/company/..." },
    { label: "YouTube URL", value: youtubeUrl, setter: setYoutubeUrl, Icon: Youtube, placeholder: "https://youtube.com/@channel" },
  ] as const;

  return (
    <div className="space-y-5">
      <h3 className="font-display text-2xl uppercase tracking-wide text-foreground">Footer &amp; Social</h3>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Footer Tagline</label>
          <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Keeping your apps alive, 24/7."
            className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SOCIAL_FIELDS.map(({ label, value, setter, Icon, placeholder }) => (
            <div key={label} className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Icon className="w-3 h-3" />{label}</label>
              <input type="url" value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Privacy Policy URL</label>
            <input type="url" value={privacyUrl} onChange={(e) => setPrivacyUrl(e.target.value)} placeholder="https://yoursite.com/privacy"
              className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Terms of Service URL</label>
            <input type="url" value={termsUrl} onChange={(e) => setTermsUrl(e.target.value)} placeholder="https://yoursite.com/terms"
              className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="font-mono text-xs uppercase tracking-widest">
          {save.isPending ? "Saving…" : "Save Footer Settings"}
        </Button>
      </div>
    </div>
  );
}

// ── Plans Section ─────────────────────────────────────────────────────────────
function PlansSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading } = useQuery<AdminPlan[]>({
    queryKey: ["admin-plans"],
    queryFn: () => apiFetch("/api/admin/plans"),
  });

  const [edits, setEdits] = useState<Record<string, { priceUsd: string; isActive: boolean }>>({});

  useEffect(() => {
    if (plans.length > 0) {
      const initial: Record<string, { priceUsd: string; isActive: boolean }> = {};
      plans.forEach((p) => {
        initial[p.slug] = { priceUsd: parseFloat(p.priceUsd).toFixed(2), isActive: p.isActive };
      });
      setEdits(initial);
    }
  }, [plans]);

  const savePlan = useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: { priceUsd: number; isActive: boolean } }) =>
      apiFetch(`/api/admin/plans/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      queryClient.invalidateQueries({ queryKey: ["public-plans"] });
      toast({ title: "Plan updated" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to save plan" }),
  });

  const DURATION_LABELS: Record<string, string> = {
    weekly: "7 days", monthly: "30 days", quarterly: "90 days",
    biannual: "180 days", yearly: "365 days",
  };

  if (isLoading) return <div className="animate-pulse font-mono text-xs text-muted-foreground">Loading plans…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl uppercase tracking-wide text-foreground">Plan Configuration</h3>
        <span className="font-mono text-[10px] text-muted-foreground">Prices in USD · auto-converted per user's country</span>
      </div>
      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              {["Plan", "Duration", "Price (USD)", "Monitor Limit", "Active", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {plans.map((plan) => {
              const edit = edits[plan.slug] ?? { priceUsd: parseFloat(plan.priceUsd).toFixed(2), isActive: plan.isActive };
              return (
                <tr key={plan.slug} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-bold text-foreground">{plan.name}</div>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-widest">{plan.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{DURATION_LABELS[plan.slug] ?? `${plan.durationDays}d`}</td>
                  <td className="px-4 py-3">
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={edit.priceUsd}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [plan.slug]: { ...edit, priceUsd: e.target.value } }))}
                        className="w-full bg-background border border-border rounded px-2.5 py-1.5 pl-6 font-mono text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-primary font-bold">{plan.monitorLimit === -1 ? "Unlimited" : plan.monitorLimit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEdits((prev) => ({ ...prev, [plan.slug]: { ...edit, isActive: !edit.isActive } }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${edit.isActive ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${edit.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      onClick={() => savePlan.mutate({ slug: plan.slug, data: { priceUsd: parseFloat(edit.priceUsd) || 0, isActive: edit.isActive } })}
                      disabled={savePlan.isPending}
                      className="font-mono text-[10px] h-7 px-3"
                    >
                      Save
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">
        * Prices are converted to the user's local currency (NGN, KES, GHS, ZAR, etc.) at live exchange rates when the user loads the upgrade page.
      </p>
    </div>
  );
}

// ── OG Metadata Section ───────────────────────────────────────────────────────
interface OgSettings { ogTitle: string; ogDescription: string; ogImage: string; ogUrl: string; }

function OgMetaSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [ogUrl, setOgUrl] = useState("");

  const { data } = useQuery<OgSettings>({ queryKey: ["admin-og-settings"], queryFn: () => apiFetch("/api/admin/settings/og") });

  useEffect(() => {
    if (data) {
      setOgTitle(data.ogTitle ?? "");
      setOgDescription(data.ogDescription ?? "");
      setOgImage(data.ogImage ?? "");
      setOgUrl(data.ogUrl ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiFetch("/api/admin/settings/og", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ogTitle, ogDescription, ogImage, ogUrl }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-og-settings"] }); toast({ title: "OG metadata saved" }); },
    onError: () => toast({ variant: "destructive", title: "Failed to save" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-2xl uppercase tracking-wide text-foreground">OG / Social Preview</h3>
        <p className="font-mono text-[11px] text-muted-foreground mt-1">Controls how your site looks when shared on Twitter, WhatsApp, LinkedIn, etc.</p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">OG Title</label>
          <input type="text" value={ogTitle} onChange={(e) => setOgTitle(e.target.value)} placeholder="wolfXmonitor — Know When Your Sites Go Down"
            className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">OG Description</label>
          <textarea value={ogDescription} onChange={(e) => setOgDescription(e.target.value)} rows={2} placeholder="Real-time uptime monitoring with instant alerts..."
            className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors resize-none" />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">OG Image URL</label>
          <input type="url" value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://monitor.xwolf.space/og-image.png"
            className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
          <p className="font-mono text-[10px] text-muted-foreground">Paste a direct image URL (1200×630 recommended). Leave empty to use no preview image.</p>
        </div>
        {ogImage && (
          <div className="border border-border rounded overflow-hidden">
            <img src={ogImage} alt="OG preview" className="w-full max-h-48 object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Canonical URL</label>
          <input type="url" value={ogUrl} onChange={(e) => setOgUrl(e.target.value)} placeholder="https://monitor.xwolf.space"
            className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="font-mono text-xs uppercase tracking-widest">
          {save.isPending ? "Saving…" : "Save OG Settings"}
        </Button>
      </div>
    </div>
  );
}

// ── Security Notification Settings ────────────────────────────────────────────
interface SecurityNotifSettings { securityAlertEmail: string; }

function SecurityNotifSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  const { data } = useQuery<SecurityNotifSettings>({ queryKey: ["admin-security-settings"], queryFn: () => apiFetch("/api/admin/settings/security") });

  useEffect(() => { if (data) setEmail(data.securityAlertEmail ?? ""); }, [data]);

  const save = useMutation({
    mutationFn: () => apiFetch("/api/admin/settings/security", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ securityAlertEmail: email }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-security-settings"] }); toast({ title: "Security alert email updated" }); },
    onError: () => toast({ variant: "destructive", title: "Failed to save" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-2xl uppercase tracking-wide text-foreground">Security Notifications</h3>
        <p className="font-mono text-[11px] text-muted-foreground mt-1">Email address that receives brute force, blocked IP, and suspicious activity alerts.</p>
      </div>
      <div className="space-y-1.5">
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Security Alert Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com"
          className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors" />
        <p className="font-mono text-[10px] text-muted-foreground">Alerts are rate-limited (max 1 per event type per IP every 5 min) to avoid spam.</p>
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending || !email.trim()} className="font-mono text-xs uppercase tracking-widest">
        {save.isPending ? "Saving…" : "Save Alert Email"}
      </Button>
    </div>
  );
}

// ── Main Admin Component ──────────────────────────────────────────────────────
export default function Admin() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tabFromUrl = (new URLSearchParams(search).get("tab") ?? "overview") as Tab;
  const [tab, setTab] = useState<Tab>(tabFromUrl);

  useEffect(() => {
    const t = (new URLSearchParams(search).get("tab") ?? "overview") as Tab;
    setTab(t);
  }, [search]);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) setLocation("/dashboard");
  }, [isLoading, user, setLocation]);

  const { data: stats } = useQuery<AdminStats>({ queryKey: ["admin-stats"], queryFn: () => apiFetch("/api/admin/stats"), refetchInterval: 15000 });
  const { data: users = [], isLoading: loadingUsers } = useQuery<AdminUser[]>({ queryKey: ["admin-users"], queryFn: () => apiFetch("/api/admin/users"), refetchInterval: 30000 });
  const { data: monitors = [], isLoading: loadingMonitors } = useQuery<AdminMonitor[]>({ queryKey: ["admin-monitors"], queryFn: () => apiFetch("/api/admin/monitors"), refetchInterval: 15000 });
  const { data: activity = [], isLoading: loadingActivity } = useQuery<ActivityEntry[]>({ queryKey: ["admin-activity"], queryFn: () => apiFetch("/api/admin/activity"), refetchInterval: 10000, enabled: tab === "activity" });
  const { data: payments = [], isLoading: loadingPayments } = useQuery<PaymentRow[]>({ queryKey: ["admin-payments"], queryFn: () => apiFetch("/api/admin/payments"), refetchInterval: 30000, enabled: tab === "payments" });
  const { data: securityEvents = [], isLoading: loadingSecEvents } = useQuery<SecurityEvent[]>({ queryKey: ["admin-security-events"], queryFn: () => apiFetch("/api/admin/security/events"), refetchInterval: 15000, enabled: tab === "security" });
  const { data: blockedIps = [], isLoading: loadingBlockedIps } = useQuery<BlockedIp[]>({ queryKey: ["admin-blocked-ips"], queryFn: () => apiFetch("/api/admin/security/blocked-ips"), refetchInterval: 15000, enabled: tab === "security" });
  const { data: secStats } = useQuery<SecurityStats>({ queryKey: ["admin-security-stats"], queryFn: () => apiFetch("/api/admin/security/stats"), refetchInterval: 20000 });

  const blockIp = useMutation({
    mutationFn: ({ ip, reason }: { ip: string; reason?: string }) =>
      apiFetch("/api/admin/security/block-ip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ip, reason }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-blocked-ips"] }); queryClient.invalidateQueries({ queryKey: ["admin-security-stats"] }); toast({ title: "IP blocked" }); },
    onError: () => toast({ variant: "destructive", title: "Failed to block IP" }),
  });
  const unblockIp = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/admin/security/blocked-ips/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-blocked-ips"] }); queryClient.invalidateQueries({ queryKey: ["admin-security-stats"] }); toast({ title: "IP unblocked" }); },
    onError: () => toast({ variant: "destructive", title: "Failed to unblock IP" }),
  });
  const resolveEvent = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/security/events/${id}/resolve`, { method: "PATCH", headers: { "content-type": "application/json" } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-security-events"] }); queryClient.invalidateQueries({ queryKey: ["admin-security-stats"] }); },
  });
  const toggleMonitor = useMutation({ mutationFn: (id: number) => apiFetch(`/api/admin/monitors/${id}/toggle`, { method: "PATCH", headers: { "content-type": "application/json" } }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-monitors"] }); queryClient.invalidateQueries({ queryKey: ["admin-stats"] }); } });
  const deleteMonitor = useMutation({ mutationFn: (id: number) => fetch(`${BASE}/api/admin/monitors/${id}`, { method: "DELETE", credentials: "include" }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-monitors"] }); queryClient.invalidateQueries({ queryKey: ["admin-stats"] }); toast({ title: "Monitor deleted" }); } });
  const deleteUser = useMutation({ mutationFn: (id: number) => fetch(`${BASE}/api/admin/users/${id}`, { method: "DELETE", credentials: "include" }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); queryClient.invalidateQueries({ queryKey: ["admin-stats"] }); toast({ title: "User deleted" }); } });
  const toggleAdmin = useMutation({ mutationFn: (id: number) => apiFetch(`/api/admin/users/${id}/toggle-admin`, { method: "PATCH", headers: { "content-type": "application/json" } }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }) });
  const changePlan = useMutation({
    mutationFn: ({ id, plan }: { id: number; plan: string }) =>
      apiFetch(`/api/admin/users/${id}/plan`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "Plan updated" }); },
    onError: () => toast({ variant: "destructive", title: "Failed to update plan" }),
  });

  if (isLoading || !user?.isAdmin) return null;

  const tabs: { id: Tab; label: string; icon: React.ElementType; alert?: boolean }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "monitors", label: `Monitors (${monitors.length})`, icon: Server },
    { id: "users", label: `Users (${users.length})`, icon: Users },
    { id: "activity", label: "Activity", icon: RefreshCw },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "security", label: `Security${secStats?.unresolved ? ` (${secStats.unresolved})` : ""}`, icon: Shield, alert: (secStats?.unresolved ?? 0) > 0 },
  ];

  return (
    <Layout>
      <Helmet>
        <title>Admin Panel — wolfXmonitor</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="space-y-8">
        <div className="pb-6 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <p className="font-mono text-xs text-primary uppercase tracking-widest">Admin Panel</p>
          </div>
          <h1 className="font-display text-5xl uppercase tracking-wide text-foreground leading-none">System Control</h1>
          <p className="font-mono text-sm text-muted-foreground mt-2">Manage all users, monitors, and system activity.</p>
        </div>

        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon, alert }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`relative flex items-center gap-2 font-mono text-xs uppercase tracking-widest px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"} ${alert ? "text-yellow-500" : ""}`}>
              <Icon className="w-3.5 h-3.5" />{label}
              {alert && <span className="absolute top-2 right-1.5 w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Users", value: stats?.totalUsers ?? "—", icon: Users, color: "text-foreground" },
                { label: "Total Monitors", value: stats?.totalMonitors ?? "—", icon: Server, color: "text-foreground" },
                { label: "Monitors Up", value: stats?.monitorsUp ?? "—", icon: CheckCircle2, color: "text-primary" },
                { label: "Monitors Down", value: stats?.monitorsDown ?? "—", icon: XCircle, color: "text-destructive" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="border border-border bg-card rounded p-5 card-hover">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
                    <Icon className={`w-4 h-4 ${color} opacity-50`} />
                  </div>
                  <div className={`font-display text-5xl leading-none ${color}`}>{value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="border border-border bg-card rounded p-5"><div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Total Pings</div><div className="font-display text-5xl text-foreground leading-none">{stats?.totalPings?.toLocaleString() ?? "—"}</div></div>
              <div className="border border-border bg-card rounded p-5"><div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Global Uptime</div><div className="font-display text-5xl text-primary leading-none">{stats ? `${stats.globalUptime.toFixed(1)}%` : "—"}</div></div>
              <div className="border border-border bg-card rounded p-5"><div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Unknown Status</div><div className="font-display text-5xl text-muted-foreground leading-none">{stats?.monitorsUnknown ?? "—"}</div></div>
            </div>
            <div>
              <h2 className="font-display text-2xl uppercase tracking-wide text-muted-foreground mb-4">Recent Monitors</h2>
              <div className="border border-border bg-card rounded overflow-hidden">
                <table className="w-full text-xs font-mono">
                  <thead><tr className="border-b border-border">{["Monitor", "User", "Status", "Last Pinged", "Interval"].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-border">
                    {monitors.slice(0, 8).map(m => (
                      <tr key={m.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3"><div className="font-bold text-foreground truncate max-w-[160px]">{m.name}</div><div className="text-muted-foreground truncate max-w-[160px]">{m.url}</div></td>
                        <td className="px-4 py-3 text-muted-foreground">{m.userName ?? "—"}</td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border ${m.lastStatus === "up" ? "bg-primary/10 text-primary border-primary/25" : m.lastStatus === "down" ? "bg-destructive/10 text-destructive border-destructive/25" : "bg-muted/20 text-muted-foreground border-border"}`}>{m.lastStatus.toUpperCase()}</span></td>
                        <td className="px-4 py-3 text-muted-foreground">{m.lastPingedAt ? formatDistanceToNow(new Date(m.lastPingedAt), { addSuffix: true }) : "Never"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{m.intervalMinutes}m</td>
                      </tr>
                    ))}
                    {monitors.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No monitors yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Monitors tab */}
        {tab === "monitors" && (
          <div className="border border-border bg-card rounded overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead><tr className="border-b border-border">{["Monitor / URL", "Owner", "Status", "Response", "Last Ping", "Interval", "Actions"].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {monitors.map(m => (
                  <tr key={m.id} className="hover:bg-white/[0.02] group">
                    <td className="px-4 py-3"><div className="font-bold text-foreground">{m.name}</div><a href={m.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary truncate block max-w-[200px]">{m.url}</a></td>
                    <td className="px-4 py-3 text-muted-foreground">{m.userName ?? "—"}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><span className={`status-dot ${m.lastStatus}`} /><span className={m.lastStatus === "up" ? "text-primary" : m.lastStatus === "down" ? "text-destructive" : "text-muted-foreground"}>{m.lastStatus.toUpperCase()}</span>{!m.active && <span className="text-[10px] text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-1 rounded">PAUSED</span>}</div></td>
                    <td className="px-4 py-3 text-muted-foreground">{m.lastResponseTimeMs ? <span className="text-primary">{m.lastResponseTimeMs}ms</span> : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.lastPingedAt ? formatDistanceToNow(new Date(m.lastPingedAt), { addSuffix: true }) : "Never"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.intervalMinutes}m</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-primary" onClick={() => toggleMonitor.mutate(m.id)}>{m.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}</Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => { if (confirm(`Delete "${m.name}"?`)) deleteMonitor.mutate(m.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div></td>
                  </tr>
                ))}
                {!loadingMonitors && monitors.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No monitors</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Users tab */}
        {tab === "users" && (
          <div className="border border-border bg-card rounded overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead><tr className="border-b border-border">{["User", "Email", "Country", "Plan", "Monitors", "Joined", "Actions"].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-white/[0.02] group">
                    <td className="px-4 py-3 font-bold text-foreground">{u.name}{u.isAdmin && <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest bg-primary/10 text-primary border border-primary/25"><ShieldCheck className="w-2.5 h-2.5" />ADMIN</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.country ? (
                        <span className="inline-flex items-center gap-1.5" title={COUNTRY_NAMES[u.country.toUpperCase()] ?? u.country}>
                          <span className="text-base leading-none">{countryFlag(u.country)}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{u.country.toUpperCase()}</span>
                        </span>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.plan ?? "free"}
                        disabled={changePlan.isPending}
                        onChange={(e) => changePlan.mutate({ id: u.id, plan: e.target.value })}
                        className={`font-mono text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border bg-background cursor-pointer outline-none transition-colors ${u.plan === "pro" ? "text-primary border-primary/30 bg-primary/5" : "text-muted-foreground border-border"}`}
                      >
                        <option value="free">FREE</option>
                        <option value="pro">PRO</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-foreground font-bold">{u.monitorCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(u.createdAt), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-[10px] hover:text-primary" onClick={() => toggleAdmin.mutate(u.id)} title={u.isAdmin ? "Remove admin" : "Make admin"}><ShieldCheck className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => { if (confirm(`Delete user "${u.name}"?`)) deleteUser.mutate(u.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div></td>
                  </tr>
                ))}
                {!loadingUsers && users.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No users</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Activity tab */}
        {tab === "activity" && (
          <div className="border border-border bg-card rounded overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-display text-xl uppercase tracking-wide text-muted-foreground">Live Ping Log</h3>
              <span className="font-mono text-xs text-muted-foreground">Last 100 pings</span>
            </div>
            <table className="w-full text-xs font-mono">
              <thead><tr className="border-b border-border">{["Timestamp", "Monitor", "User", "Status", "Response", "Code", "Error"].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {activity.map(a => (
                  <tr key={a.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(new Date(a.createdAt), "MMM d, HH:mm:ss")}</td>
                    <td className="px-4 py-3"><div className="text-foreground font-bold truncate max-w-[140px]">{a.monitorName ?? "—"}</div><div className="text-muted-foreground truncate max-w-[140px]">{a.monitorUrl ?? ""}</div></td>
                    <td className="px-4 py-3 text-muted-foreground">{a.userName ?? "—"}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border ${a.status === "up" ? "bg-primary/10 text-primary border-primary/25" : "bg-destructive/10 text-destructive border-destructive/25"}`}>{a.status.toUpperCase()}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.responseTimeMs ? <span className="text-primary">{a.responseTimeMs}ms</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.statusCode ?? "—"}</td>
                    <td className="px-4 py-3 text-destructive truncate max-w-[160px]">{a.error ?? "—"}</td>
                  </tr>
                ))}
                {!loadingActivity && activity.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No ping activity yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Payments tab */}
        {tab === "payments" && (
          <div className="space-y-8">
            <div className="border border-border bg-card rounded p-6">
              <PlansSection />
            </div>
            <div className="border border-border bg-card rounded overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-display text-xl uppercase tracking-wide text-muted-foreground">Recent Payments</h3>
                <span className="font-mono text-xs text-muted-foreground">Last 100 transactions</span>
              </div>
              <table className="w-full text-xs font-mono">
                <thead><tr className="border-b border-border">{["Date", "User", "Amount", "Currency", "Plan", "Status", "Reference"].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-border">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(new Date(p.createdAt), "MMM d, HH:mm")}</td>
                      <td className="px-4 py-3"><div className="text-foreground font-bold">{p.userName ?? "—"}</div><div className="text-muted-foreground">{p.userEmail ?? ""}</div></td>
                      <td className="px-4 py-3 text-foreground font-bold">{(p.amount / 100).toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.currency}</td>
                      <td className="px-4 py-3"><span className="text-primary font-bold uppercase text-[10px]">{p.plan}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border ${p.status === "success" ? "bg-primary/10 text-primary border-primary/25" : p.status === "pending" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/25" : "bg-destructive/10 text-destructive border-destructive/25"}`}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-[10px] truncate max-w-[120px]">{p.paystackReference}</td>
                    </tr>
                  ))}
                  {!loadingPayments && payments.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No payments yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Security tab */}
        {tab === "security" && (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Events", value: secStats?.total ?? "—", icon: Shield, color: "text-foreground" },
                { label: "Unresolved", value: secStats?.unresolved ?? "—", icon: AlertTriangle, color: "text-yellow-500" },
                { label: "Blocked IPs", value: secStats?.blocked ?? "—", icon: Ban, color: "text-destructive" },
                { label: "Brute Force", value: secStats?.byType?.["brute_force"] ?? 0, icon: XCircle, color: "text-destructive" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="border border-border bg-card rounded p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
                    <Icon className={`w-4 h-4 ${color} opacity-50`} />
                  </div>
                  <div className={`font-display text-5xl leading-none ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Security Events */}
            <div className="border border-border bg-card rounded overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-display text-xl uppercase tracking-wide text-muted-foreground">Security Events</h3>
                <span className="font-mono text-xs text-muted-foreground">Last 200 events · auto-refreshes</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border">
                      {["Type", "IP Address", "Path", "Details", "User Agent", "Time", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {securityEvents.map(ev => {
                      const TYPE_STYLES: Record<string, string> = {
                        login_fail:       "bg-yellow-500/10 text-yellow-500 border-yellow-500/25",
                        brute_force:      "bg-destructive/10 text-destructive border-destructive/25",
                        rate_limit:       "bg-orange-500/10 text-orange-400 border-orange-500/25",
                        blocked_ip:       "bg-destructive/10 text-destructive border-destructive/25",
                        suspicious_agent: "bg-purple-500/10 text-purple-400 border-purple-500/25",
                      };
                      const style = TYPE_STYLES[ev.type] ?? "bg-muted/20 text-muted-foreground border-border";
                      return (
                        <tr key={ev.id} className={`hover:bg-white/[0.02] ${ev.resolved ? "opacity-40" : ""}`}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border ${style}`}>
                              {ev.type.replace(/_/g, " ").toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">{ev.ip}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[120px] truncate">{ev.path ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={ev.details ?? ""}>{ev.details ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate" title={ev.userAgent ?? ""}>{ev.userAgent ? ev.userAgent.slice(0, 30) + (ev.userAgent.length > 30 ? "…" : "") : "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {!ev.resolved && (
                                <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-[10px] hover:text-primary whitespace-nowrap" title="Mark resolved" onClick={() => resolveEvent.mutate(ev.id)}>
                                  <CheckCheck className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {!blockedIps.find(b => b.ip === ev.ip) && (
                                <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-[10px] hover:text-destructive whitespace-nowrap"
                                  title={`Block ${ev.ip}`}
                                  onClick={() => { if (confirm(`Block IP ${ev.ip}?`)) blockIp.mutate({ ip: ev.ip, reason: `Blocked via security event: ${ev.type}` }); }}>
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!loadingSecEvents && securityEvents.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No security events yet — that's a good sign.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Blocked IPs */}
            <div className="border border-border bg-card rounded overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-display text-xl uppercase tracking-wide text-muted-foreground">Blocked IPs</h3>
                <button
                  className="font-mono text-xs text-primary hover:underline"
                  onClick={() => {
                    const ip = prompt("Enter IP address to block:");
                    if (ip?.trim()) {
                      const reason = prompt("Reason (optional):") ?? "Manually blocked";
                      blockIp.mutate({ ip: ip.trim(), reason });
                    }
                  }}
                >
                  + Block IP
                </button>
              </div>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border">
                    {["IP Address", "Reason", "Blocked", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {blockedIps.map(b => (
                    <tr key={b.id} className="hover:bg-white/[0.02] group">
                      <td className="px-4 py-3 font-bold text-destructive">{b.ip}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.reason ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-[10px] hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => { if (confirm(`Unblock ${b.ip}?`)) unblockIp.mutate(b.id); }}>
                          Unblock
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!loadingBlockedIps && blockedIps.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No IPs blocked yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings tab */}
        {tab === "settings" && (
          <div className="max-w-2xl space-y-8">
            <div className="border border-border bg-card rounded p-6">
              <EmailSection />
            </div>
            <div className="border border-border bg-card rounded p-6">
              <BillingSection />
            </div>
            <div className="border border-border bg-card rounded p-6">
              <FooterSection />
            </div>
            <div className="border border-border bg-card rounded p-6">
              <OgMetaSection />
            </div>
            <div className="border border-border bg-card rounded p-6">
              <SecurityNotifSection />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
