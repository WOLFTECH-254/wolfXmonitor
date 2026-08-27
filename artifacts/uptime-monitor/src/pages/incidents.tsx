import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, Clock, Search, ArrowRight, RefreshCw } from "lucide-react";

interface Incident {
  id: number;
  monitor_id: number;
  status_code: number | null;
  error: string | null;
  started_at: string;
  resolved_at: string | null;
  monitor_name: string;
  monitor_url: string;
}

type FilterKey = "all" | "ongoing" | "resolved";

function formatDuration(startedAt: string, endMs: number): string {
  const start = new Date(startedAt).getTime();
  const seconds = Math.max(0, Math.floor((endMs - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function getRootCause(statusCode: number | null, error: string | null): { label: string; tone: "warn" | "bad" | "neutral" } {
  if (statusCode) {
    const labels: Record<number, string> = {
      400: "400 Bad Request", 401: "401 Unauthorized", 403: "403 Forbidden",
      404: "404 Not Found", 429: "429 Too Many Requests", 500: "500 Internal Server Error",
      502: "502 Bad Gateway", 503: "503 Service Unavailable", 504: "504 Gateway Timeout",
    };
    return { label: labels[statusCode] ?? `${statusCode} HTTP Error`, tone: statusCode >= 500 ? "bad" : "warn" };
  }
  if (error) {
    const e = error.toLowerCase();
    if (e.includes("timeout")) return { label: "Connection Timeout", tone: "warn" };
    if (e.includes("econnrefused")) return { label: "Connection Refused", tone: "bad" };
    if (e.includes("enotfound") || e.includes("dns")) return { label: "DNS Failure", tone: "bad" };
    return { label: "Connection Error", tone: "bad" };
  }
  return { label: "Unknown", tone: "neutral" };
}

const TONE_CLASS: Record<"warn" | "bad" | "neutral", string> = {
  warn: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25",
  bad: "bg-destructive/10 text-destructive border-destructive/25",
  neutral: "bg-muted text-muted-foreground border-border",
};

export default function IncidentsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [now, setNow] = useState(() => Date.now());
  const [, navigate] = useLocation();

  const { data: incidents = [], isLoading, isFetching } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: async () => {
      const res = await fetch("/api/incidents", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch incidents");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const ongoingCount = incidents.filter((i) => !i.resolved_at).length;

  // Live tick so ongoing-incident durations advance every second.
  useEffect(() => {
    if (!ongoingCount) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ongoingCount]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return incidents.filter((inc) => {
      if (filter === "ongoing" && inc.resolved_at) return false;
      if (filter === "resolved" && !inc.resolved_at) return false;
      return !q || inc.monitor_name.toLowerCase().includes(q) || inc.monitor_url.toLowerCase().includes(q);
    });
  }, [incidents, search, filter]);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: `All ${incidents.length}` },
    { key: "ongoing", label: `Ongoing ${ongoingCount}` },
    { key: "resolved", label: `Resolved ${incidents.length - ongoingCount}` },
  ];

  return (
    <Layout>
      <Helmet>
        <title>Incidents — GuardiX</title>
        <meta name="description" content="Browse your downtime history and incident log across all monitors." />
      </Helmet>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap pb-5 border-b border-border">
          <div>
            <h1 className="font-display text-3xl text-foreground">
              Incidents<span className="text-primary">.</span>
            </h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              {ongoingCount > 0 ? (
                <span className="text-destructive">{ongoingCount} ongoing — check your monitors</span>
              ) : (
                "All incidents resolved"
              )}
              <span className={`ml-2 inline-flex items-center gap-1 ${isFetching ? "text-primary" : "text-muted-foreground/50"}`}>
                <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} /> live
              </span>
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name or URL…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 font-mono text-sm h-9 bg-card border-border"
            />
          </div>
        </div>

        {!isLoading && incidents.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-md border transition-colors ${
                  filter === f.key
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border border-border bg-card rounded-lg h-14 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-primary mx-auto" />
            <p className="font-display text-lg text-foreground">No incidents found</p>
            <p className="font-mono text-xs text-muted-foreground">
              {search || filter !== "all" ? "Try a different filter." : "Your monitors have been running without issues."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-border bg-card/60">
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 w-28">Status</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3">Monitor</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3">Root cause</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 hidden lg:table-cell">Started</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 hidden md:table-cell">Duration</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((incident, idx) => {
                  const isResolved = !!incident.resolved_at;
                  const rootCause = getRootCause(incident.status_code, incident.error);
                  const endMs = incident.resolved_at ? new Date(incident.resolved_at).getTime() : now;
                  return (
                    <tr
                      key={incident.id}
                      onClick={() => navigate(`/monitors/${incident.monitor_id}`)}
                      className={`border-b border-border last:border-0 transition-colors hover:bg-card/50 cursor-pointer group ${idx % 2 === 0 ? "bg-background" : "bg-card/20"}`}
                    >
                      <td className="px-4 py-3">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-primary">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-destructive">
                            <AlertTriangle className="w-3.5 h-3.5" /> Ongoing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-foreground font-medium group-hover:text-primary transition-colors">{incident.monitor_name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[220px]">{incident.monitor_url}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block font-mono text-[10px] px-2 py-0.5 rounded border ${TONE_CLASS[rootCause.tone]}`}>
                          {rootCause.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">{formatDatetime(incident.started_at)}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1 font-mono text-xs ${isResolved ? "text-muted-foreground" : "text-destructive"}`}>
                          <Clock className="w-3 h-3" />
                          {formatDuration(incident.started_at, endMs)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity inline" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="font-mono text-[10px] text-muted-foreground text-right">
          {filtered.length} incident{filtered.length !== 1 ? "s" : ""} shown · refreshes every 30s
        </p>
      </div>
    </Layout>
  );
}
