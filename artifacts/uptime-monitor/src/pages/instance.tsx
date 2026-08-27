import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Zap, CheckCircle2, XCircle, ArrowLeft, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Ping { id: number; status: string; responseTimeMs: number | null; statusCode: number | null; error: string | null; createdAt: string; }
interface InstanceData {
  monitor: { id: number; name: string; url: string; lastStatus: string; lastPingedAt: string | null; lastResponseTimeMs: number | null; intervalMinutes: number; createdAt: string; userName: string | null };
  pings: Ping[];
  uptime: number | null;
}

export default function InstancePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, isLoading, error } = useQuery<InstanceData>({
    queryKey: ["public-instance", id],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/status/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!id,
  });

  if (isLoading) return (
    <div className="min-h-screen bg-background dark flex items-center justify-center">
      <div className="font-mono text-xs text-muted-foreground animate-pulse uppercase tracking-widest">Loading…</div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-background dark flex flex-col items-center justify-center gap-4">
      <XCircle className="w-12 h-12 text-destructive/40" />
      <p className="font-mono text-sm text-muted-foreground">Monitor not found.</p>
      <Link href="/status" className="font-mono text-xs text-primary hover:underline">← Back to status page</Link>
    </div>
  );

  const { monitor, pings, uptime } = data;
  const isUp = monitor.lastStatus === "up";
  const isDown = monitor.lastStatus === "down";

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <Helmet>
        <title>Status Page — GuardiX</title>
        <meta name="description" content="Live public status page showing real-time uptime and response time for monitored services." />
        <meta property="og:title" content="Status Page — GuardiX" />
      </Helmet>
      <nav className="border-b border-border px-6 md:px-12 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-xl tracking-wide">Guardi<span className="text-primary">X</span></span>
        </Link>
        <Link href="/status" className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">
          <ArrowLeft className="w-3 h-3" /> All services
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Status header */}
        <div className={`rounded border p-8 mb-8 ${isUp ? "border-primary/40 bg-primary/5" : isDown ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Service Status</div>
              <h1 className="font-display text-4xl uppercase tracking-wide text-foreground leading-none mb-3">{monitor.name}</h1>
              <a href={monitor.url} target="_blank" rel="noreferrer" className="font-mono text-sm text-muted-foreground hover:text-primary transition-colors">{monitor.url}</a>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded border font-bold font-mono text-sm tracking-widest shrink-0 ${
              isUp ? "bg-primary/10 text-primary border-primary/30"
              : isDown ? "bg-destructive/10 text-destructive border-destructive/30"
              : "bg-muted/20 text-muted-foreground border-border"
            }`}>
              {isUp ? <CheckCircle2 className="w-4 h-4" /> : isDown ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              {monitor.lastStatus.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Uptime (90 pings)", value: uptime != null ? `${uptime.toFixed(1)}%` : "—", color: uptime != null && uptime >= 99 ? "text-primary" : uptime != null && uptime < 90 ? "text-destructive" : "text-foreground" },
            { label: "Response Time", value: monitor.lastResponseTimeMs ? `${monitor.lastResponseTimeMs}ms` : "—", color: "text-primary" },
            { label: "Check Interval", value: `${monitor.intervalMinutes}m`, color: "text-foreground" },
            { label: "Last Checked", value: monitor.lastPingedAt ? formatDistanceToNow(new Date(monitor.lastPingedAt), { addSuffix: true }) : "Never", color: "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="border border-border bg-card rounded p-4">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{label}</div>
              <div className={`font-display text-2xl leading-none ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Ping history bar */}
        {pings.length > 0 && (
          <div className="border border-border bg-card rounded p-5 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Response History</h2>
              <span className="font-mono text-[10px] text-muted-foreground">Last {pings.length} checks</span>
            </div>
            <div className="flex items-end gap-0.5 h-12">
              {[...pings].reverse().map((p) => (
                <div
                  key={p.id}
                  title={`${p.status.toUpperCase()} — ${p.responseTimeMs ? `${p.responseTimeMs}ms` : p.error ?? "no response"} — ${format(new Date(p.createdAt), "MMM d HH:mm")}`}
                  className={`flex-1 rounded-sm min-w-[3px] ${p.status === "up" ? "bg-primary" : "bg-destructive"}`}
                  style={{ height: p.status === "up" && p.responseTimeMs ? `${Math.min(100, (p.responseTimeMs / 2000) * 100 + 20)}%` : "100%" }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="font-mono text-[10px] text-muted-foreground">Older</span>
              <span className="font-mono text-[10px] text-muted-foreground">Latest</span>
            </div>
          </div>
        )}

        {/* Recent pings table */}
        <div className="border border-border bg-card rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Recent Checks</h2>
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border">
                {["Time", "Status", "Response", "Code"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pings.slice(0, 20).map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{format(new Date(p.createdAt), "MMM d, HH:mm:ss")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest border ${p.status === "up" ? "bg-primary/10 text-primary border-primary/25" : "bg-destructive/10 text-destructive border-destructive/25"}`}>
                      {p.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{p.responseTimeMs ? <span className="text-primary">{p.responseTimeMs}ms</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.statusCode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 text-center font-mono text-xs text-muted-foreground">
          Powered by <Link href="/" className="text-primary hover:underline">GuardiX</Link>
        </div>
      </div>
    </div>
  );
}
