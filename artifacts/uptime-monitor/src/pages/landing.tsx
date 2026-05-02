import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  EG: "Egypt", MA: "Morocco", SN: "Senegal",
};

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

export default function Landing() {
  const { data: countryStats = [] } = useQuery<CountryStat[]>({
    queryKey: ["country-stats"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/stats/countries`);
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const totalUsers = countryStats.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="min-h-screen bg-background text-foreground dark overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 border-b border-border bg-background/95 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-xl text-foreground">
            wolf<span className="text-primary">X</span>monitor
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/status">
            <button className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 hidden sm:block">
              Status
            </button>
          </Link>
          <Link href="/signin">
            <button className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2">
              Log In
            </button>
          </Link>
          <Link href="/signup">
            <button className="font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-5 py-2 rounded font-bold tracking-wide">
              Get Started
            </button>
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16 grid-bg">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none" />

        <div className="relative z-10 text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 rounded-full px-4 py-1.5 mb-8">
            <span className="status-dot up" />
            <span className="font-mono text-xs text-primary tracking-wider">ALL SYSTEMS OPERATIONAL</span>
          </div>

          <h1 className="font-display leading-none mb-2">
            <span className="block text-[clamp(56px,12vw,140px)] text-foreground">KEEP YOUR APPS</span>
            <span className="block text-[clamp(56px,12vw,140px)] text-primary glow-text">ALIVE.</span>
          </h1>

          <p className="font-mono text-muted-foreground text-sm md:text-base max-w-xl mx-auto mt-6 mb-3 leading-relaxed">
            I am just a wolf — watching your endpoints.
          </p>
          <p className="font-mono text-muted-foreground/70 text-sm max-w-2xl mx-auto mb-10 leading-relaxed">
            Automatically ping your Render, Railway, and Fly.io projects so they never sleep. Monitor response times, track uptime, and get notified when something breaks.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <button className="flex items-center gap-2 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-8 py-3.5 rounded font-bold tracking-wider group">
                Start Monitoring
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/signin">
              <button className="font-mono text-sm border border-border hover:border-primary/50 text-foreground hover:text-primary transition-all px-8 py-3.5 rounded tracking-wider">
                View Dashboard
              </button>
            </Link>
          </div>
        </div>

        {/* STATS BAR */}
        <div className="relative z-10 w-full max-w-4xl mx-auto mt-20">
          <div className="grid grid-cols-2 md:grid-cols-4 border border-border bg-card/80 backdrop-blur-sm rounded">
            {[
              { value: "99.9%", label: "Uptime SLA" },
              { value: "24/7", label: "Always Watching" },
              { value: "<30s", label: "Detection Speed" },
              { value: "Free", label: "Open & Forever" },
            ].map((stat, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center py-6 px-4 border-r border-b md:border-b-0 border-border last:border-r-0"
              >
                <div className="font-display text-4xl md:text-5xl text-foreground leading-none">{stat.value}</div>
                <div className="font-mono text-xs text-muted-foreground mt-2 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GLOBAL USERS — country flags */}
      {countryStats.length > 0 && (
        <section className="px-6 py-20 border-t border-border">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-3">Global Reach</p>
              <h2 className="font-display text-[clamp(32px,5vw,64px)] text-foreground leading-none">
                WATCHED FROM <span className="text-primary">{countryStats.length} COUNTRIES</span>
              </h2>
              {totalUsers > 0 && (
                <p className="font-mono text-sm text-muted-foreground mt-3">
                  {totalUsers.toLocaleString()} wolf{totalUsers !== 1 ? "ves" : ""} watching endpoints worldwide
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {countryStats.map(({ country, count: cnt }) => (
                <div
                  key={country}
                  title={`${COUNTRY_NAMES[country.toUpperCase()] ?? country} — ${cnt} user${cnt !== 1 ? "s" : ""}`}
                  className="group flex flex-col items-center gap-1.5 border border-border hover:border-primary/40 bg-card hover:bg-primary/5 rounded-lg px-4 py-3 transition-all cursor-default min-w-[72px]"
                >
                  <span className="text-2xl leading-none">{countryFlag(country)}</span>
                  <span className="font-mono text-[10px] text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-widest">
                    {country.toUpperCase()}
                  </span>
                  <span className="font-display text-lg text-primary leading-none">{cnt}</span>
                </div>
              ))}
            </div>

            {/* scrolling flag strip if many countries */}
            {countryStats.length >= 6 && (
              <p className="text-center font-mono text-[10px] text-muted-foreground/40 mt-8 uppercase tracking-widest">
                Hover any flag for the country name
              </p>
            )}
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <div className="mb-16 text-center">
          <h2 className="font-display text-[clamp(36px,6vw,72px)] text-foreground leading-none">
            HOW IT <span className="text-primary">WORKS</span>
          </h2>
          <p className="font-mono text-muted-foreground text-sm mt-4">
            Three steps to keep your projects online.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Globe,
              step: "01",
              title: "Add Your URL",
              desc: "Paste any HTTP/HTTPS endpoint — your Render app, REST API, or any web service.",
            },
            {
              icon: Clock,
              step: "02",
              title: "Set an Interval",
              desc: "Choose how often to ping — every 1, 5, 10, or 15 minutes. Prevents sleep timeouts automatically.",
            },
            {
              icon: BarChart2,
              step: "03",
              title: "Track & Monitor",
              desc: "Watch response times, uptime %, and ping logs in real-time from your dashboard.",
            },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div key={step} className="group border border-border hover:border-primary/40 bg-card rounded p-8 transition-all hover:bg-card/80 relative overflow-hidden">
              <div className="absolute top-4 right-4 font-display text-6xl text-primary/5 group-hover:text-primary/10 transition-colors leading-none select-none">
                {step}
              </div>
              <div className="w-10 h-10 bg-primary/10 border border-primary/30 rounded flex items-center justify-center mb-6">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display text-2xl text-foreground mb-3">{title}</h3>
              <p className="font-mono text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 py-16 border-t border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 mb-4">
            <h2 className="font-display text-[clamp(36px,6vw,72px)] text-foreground leading-none">
              FEATURES THAT <span className="text-primary">MATTER</span>
            </h2>
          </div>
          {[
            {
              icon: Activity,
              title: "Response Time Charts",
              desc: "Live line charts showing every ping's latency over time. Spot regressions instantly.",
            },
            {
              icon: Shield,
              title: "Uptime History",
              desc: "Color-coded bar charts — green for up, red for down. See your uptime at a glance.",
            },
            {
              icon: Bell,
              title: "Manual Ping",
              desc: "Hit 'Ping Now' to check any endpoint on-demand without waiting for the scheduler.",
            },
            {
              icon: Zap,
              title: "Auto-Scheduler",
              desc: "The server schedules pings in the background — no cron jobs, no external services.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-5 border border-border bg-card rounded p-6 hover:border-primary/30 transition-colors group">
              <div className="w-10 h-10 bg-primary/10 border border-primary/30 rounded flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-mono font-bold text-foreground mb-2">{title}</h4>
                <p className="font-mono text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FOOTER */}
      <section className="px-6 py-28 text-center border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="font-display text-[clamp(48px,10vw,110px)] text-foreground leading-none mb-6">
            WAKE UP YOUR <span className="text-primary glow-text">APPS.</span>
          </h2>
          <p className="font-mono text-muted-foreground text-sm mb-10 max-w-xl mx-auto">
            Stop letting Render put your projects to sleep. Create a free account and start monitoring in seconds.
          </p>
          <Link href="/signup">
            <button className="inline-flex items-center gap-2 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-10 py-4 rounded font-bold tracking-wider text-base group">
              Create Free Account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
          <p className="font-mono text-[11px] text-muted-foreground/40 mt-8 tracking-wider">
            Powered by <span className="text-primary/50">WOLF TECH</span> · Silent Wolf
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
