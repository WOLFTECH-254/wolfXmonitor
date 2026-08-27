import { Helmet } from "react-helmet-async";
import { BrandMark } from "@/components/brand-mark";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Zap, Shield, Clock, Activity, ArrowRight, Globe, Bell, BarChart2 } from "lucide-react";
import { Footer } from "@/components/footer";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CountryStat { country: string; count: number; }

const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria", GH: "Ghana", KE: "Kenya", ZA: "South Africa",
  US: "United States", GB: "United Kingdom", CA: "Canada", AU: "Australia",
  DE: "Germany", FR: "France", IN: "India", BR: "Brazil",
  MX: "Mexico", JP: "Japan", SG: "Singapore", AE: "UAE",
  RW: "Rwanda", TZ: "Tanzania", UG: "Uganda", ET: "Ethiopia",
  EG: "Egypt", MA: "Morocco", SN: "Senegal", PK: "Pakistan",
  PH: "Philippines", ID: "Indonesia", TR: "Turkey", NL: "Netherlands",
};

const MOCK_COUNTRIES: CountryStat[] = [
  { country: "KE", count: 38 }, { country: "NG", count: 27 },
  { country: "GH", count: 19 }, { country: "US", count: 15 },
  { country: "ZA", count: 12 }, { country: "GB", count: 9 },
  { country: "IN", count: 8 },  { country: "TZ", count: 7 },
  { country: "UG", count: 6 },  { country: "RW", count: 5 },
  { country: "CA", count: 4 },  { country: "DE", count: 4 },
  { country: "AU", count: 3 },  { country: "SG", count: 3 },
  { country: "AE", count: 2 },  { country: "PH", count: 2 },
  { country: "ET", count: 2 },  { country: "MA", count: 2 },
  { country: "FR", count: 2 },  { country: "BR", count: 1 },
  { country: "JP", count: 1 },  { country: "NL", count: 1 },
  { country: "PK", count: 1 },  { country: "EG", count: 1 },
];

// ─── Hero preview — a flat, static product mock (no motion, no glow) ───────
function HeroPreview() {
  // Deterministic 60-bar uptime history: mostly up, a few slow, two down.
  const bars = Array.from({ length: 60 }, (_, i) => {
    if (i === 17 || i === 41) return "down";
    if (i % 13 === 6) return "slow";
    return "up";
  });

  // Deterministic response-time sparkline points.
  const spark = [22, 19, 24, 20, 26, 18, 21, 30, 23, 19, 25, 20, 17, 22, 28, 21, 18, 24, 20, 19];
  const w = 320, h = 56;
  const max = Math.max(...spark), min = Math.min(...spark);
  const pts = spark
    .map((v, i) => {
      const x = (i / (spark.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * (h - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="status-dot up" />
          <span className="font-mono text-sm text-foreground truncate">api.myapp.com</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary border border-primary/30 rounded px-2 py-0.5">
          Operational
        </span>
      </div>

      <div className="mt-5 flex items-end gap-[2px] h-9">
        {bars.map((s, i) => (
          <div
            key={i}
            className={`flex-1 rounded-[1px] ${
              s === "down"
                ? "bg-destructive h-full"
                : s === "slow"
                ? "bg-muted-foreground/50 h-2/3"
                : "bg-primary/70 h-full"
            }`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>60 days</span>
        <span>99.98% uptime</span>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Response time</span>
          <span className="font-mono text-xs text-foreground">142&thinsp;ms avg</span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" preserveAspectRatio="none" aria-hidden="true">
          <polyline
            points={pts}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

// ─── Flag image ────────────────────────────────────────────────────────────
function FlagImg({ code, size = 32 }: { code: string; size?: number }) {
  const lower = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w${size}/${lower}.png`}
      srcSet={`https://flagcdn.com/w${size * 2}/${lower}.png 2x`}
      width={size} height={Math.round(size * 0.75)}
      alt={code} loading="lazy"
      className="rounded-sm object-cover"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}

// ─── Animated counter ──────────────────────────────────────────────────────
function useCountUp(target: number, duration = 2000) {
  const [value, setValue] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTriggered(true); obs.disconnect(); } },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!triggered || target === 0) return;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(step);
      else setValue(target);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [triggered, target, duration]);

  return { value, sectionRef };
}

interface OgMeta { ogTitle: string; ogDescription: string; ogImage: string; ogUrl: string; }

// ─── Page ──────────────────────────────────────────────────────────────────
export default function Landing() {
  const { data: ogMeta } = useQuery<OgMeta>({
    queryKey: ["og-meta"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/settings/og`);
      return res.ok ? res.json() : null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: realStats = [] } = useQuery<CountryStat[]>({
    queryKey: ["country-stats"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/stats/countries`);
      return res.ok ? res.json() : [];
    },
    staleTime: 60 * 1000,
  });

  const countryStats: CountryStat[] = (() => {
    const merged = new Map<string, number>(MOCK_COUNTRIES.map(c => [c.country, c.count]));
    for (const r of realStats) {
      const code = r.country.toUpperCase();
      merged.set(code, (merged.get(code) ?? 0) + r.count);
    }
    return Array.from(merged.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  })();

  const totalUsers       = countryStats.reduce((sum, r) => sum + r.count, 0);
  const { value: animatedTotal, sectionRef } = useCountUp(totalUsers);
  const visibleFlags     = countryStats.slice(0, 8);
  const extraCount       = countryStats.length - visibleFlags.length;
  const displayUsers     = Math.floor(totalUsers / 100) * 100;
  const displayCountries = Math.floor(countryStats.length / 10) * 10;

  return (
    <div className="min-h-screen bg-background text-foreground dark overflow-x-hidden">
      <Helmet>
        <title>{ogMeta?.ogTitle ?? "GuardiX — Know When Your Sites Go Down"}</title>
        <meta name="description" content={ogMeta?.ogDescription ?? "Real-time uptime monitoring with instant alerts."} />
        <meta property="og:title"       content={ogMeta?.ogTitle ?? "GuardiX — Know When Your Sites Go Down"} />
        <meta property="og:description" content={ogMeta?.ogDescription ?? "Real-time uptime monitoring with instant alerts."} />
        <meta property="og:url"         content={ogMeta?.ogUrl ?? "https://monitor.xwolf.space"} />
        {ogMeta?.ogImage && <meta property="og:image"  content={ogMeta.ogImage} />}
        {ogMeta?.ogImage && <meta name="twitter:card"  content="summary_large_image" />}
        {ogMeta?.ogImage && <meta name="twitter:image" content={ogMeta.ogImage} />}
      </Helmet>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 border-b border-border bg-background">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
            <BrandMark className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-xl text-foreground">
            Guardi<span className="text-primary">X</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/status">
            <button className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 hidden sm:block">Status</button>
          </Link>
          <Link href="/signin">
            <button className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2">Log In</button>
          </Link>
          <Link href="/signup">
            <button className="font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-5 py-2 rounded-md font-semibold tracking-wide">Get Started</button>
          </Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-32 pb-20 md:pt-40 md:pb-28 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <h1 className="font-display text-[clamp(38px,5.5vw,58px)] leading-[1.05] text-foreground">
              Keep your apps <span className="text-primary">alive.</span>
            </h1>

            <p className="text-muted-foreground text-base max-w-lg mt-6 leading-relaxed">
              Ping your Render, Railway, and Fly.io projects so they never sleep.
              Track response times and uptime, and get notified the moment something breaks.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-9">
              <Link href="/signup">
                <button className="flex items-center gap-2 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-7 py-3 rounded-md font-semibold tracking-wide group">
                  Start Monitoring
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
              <Link href="/signin">
                <button className="font-mono text-sm border border-border hover:border-muted-foreground/40 text-foreground transition-colors px-7 py-3 rounded-md tracking-wide">
                  View Dashboard
                </button>
              </Link>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <HeroPreview />
          </div>
        </div>

        {/* Stats bar */}
        <div className="w-full mt-20">
          <div className="grid grid-cols-2 md:grid-cols-4 border border-border rounded-lg overflow-hidden">
            {[
              { value: "99.9%", label: "Uptime SLA"      },
              { value: "24/7",  label: "Always Watching" },
              { value: "<30s",  label: "Detection Speed" },
              { value: "Free",  label: "Open & Forever"  },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center py-6 px-4 border-r border-b md:border-b-0 border-border last:border-r-0">
                <div className="font-display text-3xl md:text-4xl text-foreground leading-none">{stat.value}</div>
                <div className="font-mono text-[11px] text-muted-foreground mt-2 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GLOBAL REACH ─────────────────────────────────────────────────── */}
      <section ref={sectionRef} className="px-6 py-14 border-t border-border">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
          <div className="flex items-center">
            <div className="flex -space-x-3">
              {visibleFlags.map(({ country }, i) => (
                <div key={country} title={COUNTRY_NAMES[country.toUpperCase()] ?? country}
                  style={{ zIndex: visibleFlags.length - i }}
                  className="relative w-10 h-10 rounded-full border-2 border-background bg-card overflow-hidden flex items-center justify-center cursor-default hover:z-50 hover:scale-105 transition-transform">
                  <FlagImg code={country} size={40} />
                </div>
              ))}
              {extraCount > 0 && (
                <div style={{ zIndex: 0 }} className="relative w-10 h-10 rounded-full border-2 border-border bg-card flex items-center justify-center font-mono text-[10px] text-muted-foreground font-bold">
                  +{extraCount}
                </div>
              )}
            </div>
          </div>
          <div className="hidden sm:block w-px h-12 bg-border" />
          <div className="text-center sm:text-left">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-4xl md:text-5xl text-primary leading-none tabular-nums">
                {animatedTotal >= displayUsers ? `${displayUsers.toLocaleString()}+` : animatedTotal.toLocaleString()}
              </span>
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider ml-1">users</span>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground mt-1.5 tracking-wide">
              developers monitoring from{" "}
              <span className="text-foreground font-bold">{displayCountries}+ countries</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <div className="mb-14 text-center">
          <h2 className="font-display text-[clamp(28px,5vw,48px)] text-foreground leading-tight">
            How it <span className="text-primary">works</span>
          </h2>
          <p className="font-mono text-muted-foreground text-sm mt-3">Three steps to keep your projects online.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Globe,     step: "01", title: "Add Your URL",    desc: "Paste any HTTP/HTTPS endpoint — your Render app, REST API, or any web service." },
            { icon: Clock,     step: "02", title: "Set an Interval", desc: "Choose how often to ping — every 1, 5, 10, or 15 minutes. Prevents sleep timeouts automatically." },
            { icon: BarChart2, step: "03", title: "Track & Monitor", desc: "Watch response times, uptime %, and ping logs in real-time from your dashboard." },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div key={step} className="border border-border bg-card rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-md flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="font-mono text-xs text-muted-foreground">{step}</span>
              </div>
              <h3 className="font-display text-lg text-foreground mb-2">{title}</h3>
              <p className="font-mono text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-16 border-t border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 mb-2">
            <h2 className="font-display text-[clamp(28px,5vw,48px)] text-foreground leading-tight">
              Features that <span className="text-primary">matter</span>
            </h2>
          </div>
          {[
            { icon: Activity, title: "Response Time Charts", desc: "Live line charts showing every ping's latency over time. Spot regressions instantly." },
            { icon: Shield,   title: "Uptime History",       desc: "Color-coded bar charts — green for up, red for down. See your uptime at a glance." },
            { icon: Bell,     title: "Manual Ping",          desc: "Hit 'Ping Now' to check any endpoint on-demand without waiting for the scheduler." },
            { icon: Zap,      title: "Auto-Scheduler",       desc: "The server schedules pings in the background — no cron jobs, no external services." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4 border border-border bg-card rounded-lg p-5">
              <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-md flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="font-mono font-bold text-foreground mb-1.5">{title}</h4>
                <p className="font-mono text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-6 py-28 text-center border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-[clamp(32px,7vw,64px)] text-foreground leading-tight mb-5">
            Wake up your <span className="text-primary">apps.</span>
          </h2>
          <p className="font-mono text-muted-foreground text-sm mb-9 max-w-xl mx-auto">
            Stop letting Render put your projects to sleep. Create a free account and start monitoring in seconds.
          </p>
          <Link href="/signup">
            <button className="inline-flex items-center gap-2 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-8 py-3.5 rounded-md font-semibold tracking-wide group">
              Create Free Account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </Link>
          <p className="font-mono text-[11px] text-muted-foreground/50 mt-8 tracking-wide">
            Powered by <span className="text-primary/60">WOLF TECH</span> · Silent Wolf
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
