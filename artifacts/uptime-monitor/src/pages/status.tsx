import { BrandMark } from "@/components/brand-mark";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Footer } from "@/components/footer";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface StatusMonitor {
  id: number; name: string; url: string; lastStatus: string;
  lastPingedAt: string | null; lastResponseTimeMs: number | null;
  intervalMinutes: number;
}

interface StatusData {
  monitors: StatusMonitor[];
  up: number; down: number; total: number;
}

export default function StatusPage() {
  const { data, isLoading, dataUpdatedAt } = useQuery<StatusData>({
    queryKey: ["public-status"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/status`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const allUp = data && data.down === 0 && data.total > 0;
  const hasDown = data && data.down > 0;

  return (
    <>
      <Helmet>
        <title>System Status — GuardiX</title>
        <meta name="description" content="Live status of all monitored services. Check uptime, response times, and recent incidents." />
        <meta property="og:title" content="System Status — GuardiX" />
      </Helmet>
    <div className="min-h-screen bg-background text-foreground dark">
      <nav className="border-b border-border px-6 md:px-12 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
            <BrandMark className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-xl tracking-wide">Guardi<span className="text-primary">X</span></span>
        </Link>
        <a href="/dashboard" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">
          Back to site
        </a>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Global status banner */}
        <div className={`rounded border p-6 mb-12 flex items-center gap-4 ${
          isLoading ? "border-border bg-card"
          : allUp ? "border-primary/40 bg-primary/5"
          : hasDown ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-card"
        }`}>
          <div className={`w-3 h-3 rounded-full shrink-0 ${allUp ? "bg-primary" : hasDown ? "bg-destructive" : "bg-muted-foreground"}`} />
          <div>
            <div className="font-display text-3xl uppercase tracking-wide leading-none mb-1">
              {isLoading ? "Checking…" : allUp ? "All Systems Operational" : hasDown ? `${data?.down} Service${data?.down !== 1 ? "s" : ""} Down` : data?.total === 0 ? "No monitors configured" : "Checking…"}
            </div>
            {dataUpdatedAt > 0 && (
              <div className="font-mono text-xs text-muted-foreground mt-1">
                Updated {formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        {data && data.total > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-10">
            {[
              { label: "Total", value: data.total, color: "text-foreground" },
              { label: "Operational", value: data.up, color: "text-primary" },
              { label: "Down", value: data.down, color: data.down > 0 ? "text-destructive" : "text-muted-foreground" },
            ].map(({ label, value, color }) => (
              <div key={label} className="border border-border bg-card rounded p-4 text-center">
                <div className={`font-display text-4xl leading-none ${color}`}>{value}</div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Monitor list */}
        <div className="space-y-2">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Services</h2>
          {isLoading && (
            <div className="border border-border bg-card rounded p-6 text-center font-mono text-xs text-muted-foreground animate-pulse">
              Loading status…
            </div>
          )}
          {!isLoading && (data?.monitors?.length ?? 0) === 0 && (
            <div className="border border-border bg-card rounded p-8 text-center">
              <RefreshCw className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground">No active monitors yet.</p>
            </div>
          )}
          {data?.monitors.map((m) => (
            <Link key={m.id} href={`/status/${m.id}`}>
              <div className="border border-border bg-card rounded p-4 flex items-center justify-between hover:border-primary/30 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`status-dot ${m.lastStatus} shrink-0`} />
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{m.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground truncate">{m.url}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0 ml-4">
                  {m.lastResponseTimeMs && (
                    <div className="hidden sm:block text-right">
                      <div className="font-mono text-xs text-primary">{m.lastResponseTimeMs}ms</div>
                      <div className="font-mono text-[10px] text-muted-foreground">response</div>
                    </div>
                  )}
                  {m.lastPingedAt && (
                    <div className="hidden md:block text-right">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(m.lastPingedAt), { addSuffix: true })}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">last ping</div>
                    </div>
                  )}
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold tracking-widest border ${
                    m.lastStatus === "up" ? "bg-primary/10 text-primary border-primary/25"
                    : m.lastStatus === "down" ? "bg-destructive/10 text-destructive border-destructive/25"
                    : "bg-muted/20 text-muted-foreground border-border"}`}>
                    {m.lastStatus === "up" ? <CheckCircle2 className="w-3 h-3" /> : m.lastStatus === "down" ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {m.lastStatus.toUpperCase()}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
    <Footer />
    </>
  );
}
