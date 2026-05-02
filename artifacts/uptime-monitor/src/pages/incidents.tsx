import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, Search } from "lucide-react";

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

function formatDuration(startedAt: string, resolvedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const diffMs = end - start;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatDatetime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getRootCause(statusCode: number | null, error: string | null): { label: string; color: string } {
  if (statusCode) {
    const labels: Record<number, string> = {
      400: "400 Bad Request",
      401: "401 Unauthorized",
      403: "403 Forbidden",
      404: "404 Not Found",
      429: "429 Too Many Requests",
      500: "500 Internal Server Error",
      502: "502 Bad Gateway",
      503: "503 Service Unavailable",
      504: "504 Gateway Timeout",
    };
    const label = labels[statusCode] ?? `${statusCode} HTTP Error`;
    const color = statusCode >= 500 ? "bg-red-900/60 text-red-300 border-red-800" : "bg-orange-900/60 text-orange-300 border-orange-800";
    return { label, color };
  }
  if (error) {
    if (error.toLowerCase().includes("timeout")) return { label: "Connection Timeout", color: "bg-yellow-900/60 text-yellow-300 border-yellow-800" };
    if (error.toLowerCase().includes("econnrefused")) return { label: "Connection Refused", color: "bg-red-900/60 text-red-300 border-red-800" };
    if (error.toLowerCase().includes("enotfound") || error.toLowerCase().includes("dns")) return { label: "DNS Failure", color: "bg-red-900/60 text-red-300 border-red-800" };
    return { label: "Connection Error", color: "bg-red-900/60 text-red-300 border-red-800" };
  }
  return { label: "Unknown", color: "bg-muted text-muted-foreground border-border" };
}

export default function IncidentsPage() {
  const [search, setSearch] = useState("");

  const { data: incidents = [], isLoading } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: async () => {
      const res = await fetch("/api/incidents", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch incidents");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const filtered = incidents.filter((inc) => {
    const q = search.toLowerCase();
    return !q || inc.monitor_name.toLowerCase().includes(q) || inc.monitor_url.toLowerCase().includes(q);
  });

  const ongoing = incidents.filter((i) => !i.resolved_at).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl text-foreground">
              Incidents<span className="text-primary">.</span>
            </h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              {ongoing > 0
                ? `${ongoing} ongoing incident${ongoing > 1 ? "s" : ""} — check your monitors`
                : "All incidents resolved"}
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

        {isLoading ? (
          <div className="font-mono text-xs text-muted-foreground animate-pulse py-12 text-center tracking-widest uppercase">
            Loading incidents…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded border border-border bg-card p-12 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-primary mx-auto" />
            <p className="font-display text-lg text-foreground">No incidents found</p>
            <p className="font-mono text-xs text-muted-foreground">
              {search ? "Try a different search term." : "Your monitors have been running without issues."}
            </p>
          </div>
        ) : (
          <div className="rounded border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card/60">
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 w-28">Status</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3">Monitor</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3">Root Cause</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 hidden lg:table-cell">Started</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 hidden lg:table-cell">Resolved</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 hidden md:table-cell">Duration</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((incident, idx) => {
                  const isResolved = !!incident.resolved_at;
                  const rootCause = getRootCause(incident.status_code, incident.error);
                  return (
                    <tr
                      key={incident.id}
                      className={`border-b border-border last:border-0 transition-colors hover:bg-card/40 ${idx % 2 === 0 ? "bg-background" : "bg-card/20"}`}
                    >
                      <td className="px-4 py-3">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-red-400 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Ongoing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-foreground font-medium">{incident.monitor_name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">{incident.monitor_url}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block font-mono text-[10px] px-2 py-0.5 rounded border ${rootCause.color}`}>
                          {rootCause.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {formatDatetime(incident.started_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {isResolved ? (
                          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {formatDatetime(incident.resolved_at!)}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-red-400/70">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDuration(incident.started_at, incident.resolved_at)}
                        </span>
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
