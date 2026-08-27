import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout";
import {
  useGetMonitor,
  useGetMonitorPings,
  useGetMonitorStats,
  useDeleteMonitor,
  useTriggerPing,
  useUpdateMonitor,
  getGetMonitorQueryKey,
  getGetMonitorPingsQueryKey,
  getGetMonitorStatsQueryKey,
  getListMonitorsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Pause, Play, Trash2, ExternalLink, Globe, Pencil, ShieldCheck, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow, formatDuration, intervalToDuration } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip,
} from "recharts";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";

function UptimeBar({ pings }: { pings: Array<{ status: string }> }) {
  if (!pings.length) return <div className="text-muted-foreground font-mono text-xs">No data</div>;
  const recent = [...pings].slice(0, 90).reverse();
  return (
    <div className="flex gap-[2px] items-end h-8">
      {recent.map((p, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm min-w-[3px] h-full ${p.status === "up" ? "bg-primary/80" : "bg-destructive/80"}`}
          title={p.status === "up" ? "Up" : "Down"}
        />
      ))}
    </div>
  );
}

function UptimeStat({
  label, percent, incidents, subLabel
}: { label: string; percent: number; incidents: number; subLabel?: string }) {
  const color = percent >= 99 ? "text-primary" : percent >= 95 ? "text-yellow-400" : "text-destructive";
  return (
    <div className="border border-border bg-card rounded p-4 space-y-1">
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</div>
      <div className={`font-display text-3xl leading-none ${color}`}>{percent.toFixed(3)}%</div>
      <div className="font-mono text-[10px] text-muted-foreground">
        {incidents > 0 ? `${incidents} incident${incidents !== 1 ? "s" : ""}` : "No incidents"}
        {subLabel && <span className="ml-1">{subLabel}</span>}
      </div>
    </div>
  );
}

interface SslInfo {
  sslCheckEnabled?: boolean;
  sslStatus?: string | null;
  sslExpiresAt?: string | null;
  sslDaysRemaining?: number | null;
  sslIssuer?: string | null;
  sslLastCheckedAt?: string | null;
}

export default function MonitorDetail() {
  const { id: idStr } = useParams();
  const id = Number(idStr);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const sslAvailable = !!user?.planLimits?.sslMonitoring;

  const { data: monitor, isLoading: isLoadingMonitor } = useGetMonitor(id, {
    query: { enabled: !!id, refetchInterval: 30000 }
  });
  const { data: stats } = useGetMonitorStats(id, {
    query: { enabled: !!id, refetchInterval: 30000 }
  });
  const { data: pings } = useGetMonitorPings(id, { limit: 100 }, {
    query: { enabled: !!id, refetchInterval: 30000 }
  });

  const deleteMonitor = useDeleteMonitor();
  const triggerPing = useTriggerPing();
  const updateMonitor = useUpdateMonitor();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editInterval, setEditInterval] = useState(5);

  const openEdit = () => {
    if (!monitor) return;
    setEditName(monitor.name);
    setEditUrl(monitor.url);
    setEditInterval(monitor.intervalMinutes);
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!monitor) return;
    updateMonitor.mutate({ id, data: { name: editName, url: editUrl, intervalMinutes: editInterval } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMonitorQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
        setEditOpen(false);
        toast({ title: "Monitor updated" });
      },
      onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to update monitor." })
    });
  };

  const handleDelete = () => {
    deleteMonitor.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
        toast({ title: "Monitor deleted" });
        setLocation("/monitoring");
      },
      onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to delete monitor." })
    });
  };

  const handlePing = () => {
    triggerPing.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMonitorQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetMonitorStatsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetMonitorPingsQueryKey(id) });
        toast({ title: "Ping sent" });
      }
    });
  };

  const handleToggle = () => {
    if (!monitor) return;
    updateMonitor.mutate({ id, data: { active: !monitor.active } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMonitorQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Monitor updated", description: `Monitor is now ${!monitor.active ? "active" : "paused"}.` });
      }
    });
  };

  const ssl = monitor as unknown as SslInfo;

  const handleToggleSsl = () => {
    if (!monitor) return;
    updateMonitor.mutate(
      { id, data: { sslCheckEnabled: !ssl.sslCheckEnabled } as never },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMonitorQueryKey(id) });
          toast({ title: ssl.sslCheckEnabled ? "SSL monitoring off" : "SSL monitoring on", description: ssl.sslCheckEnabled ? undefined : "First certificate check runs within a few minutes." });
        },
        onError: (err: unknown) => {
          const body = (err as { data?: { error?: string } }).data;
          toast({ variant: "destructive", title: "Could not update", description: body?.error ?? "Failed to toggle SSL monitoring." });
        },
      },
    );
  };

  if (isLoadingMonitor || !monitor) {
    return (
      <Layout>
        <Helmet><title>Monitor — GuardiX</title></Helmet>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded" />)}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded" />)}
          </div>
          <Skeleton className="h-[240px] w-full rounded" />
        </div>
      </Layout>
    );
  }

  const isDown = monitor.lastStatus === "down";
  const isUp = monitor.lastStatus === "up";
  const reversedPings = pings ? [...pings].reverse() : [];

  const chartData = reversedPings.map(p => ({
    time: format(new Date(p.createdAt), "HH:mm"),
    responseTime: p.responseTimeMs ?? null,
    status: p.status,
  }));

  const downSince = (() => {
    if (!isDown || !pings) return null;
    for (const p of pings) {
      if (p.status === "up") return p.createdAt;
    }
    return null;
  })();

  const currentStatusDuration = (() => {
    if (!monitor.lastPingedAt) return null;
    const ref = downSince ?? monitor.lastPingedAt;
    return formatDuration(intervalToDuration({ start: new Date(ref), end: new Date() }), { format: ["days", "hours", "minutes"] }) || "just now";
  })();

  return (
    <Layout>
      <Helmet>
        <title>{monitor.url} — GuardiX</title>
        <meta name="description" content={`Live uptime monitoring for ${monitor.url}. Track response times, incidents, and SLA.`} />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="space-y-6">
        {/* Breadcrumb + header */}
        <div>
          <Link href="/monitoring">
            <button className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-primary transition-colors mb-4">
              <ArrowLeft className="w-3.5 h-3.5" />
              Monitoring
            </button>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-4 h-4 rounded-full shrink-0 ${isDown ? "bg-destructive" : isUp ? "bg-primary" : "bg-muted-foreground/40"}`} />
              <div className="min-w-0">
                <h1 className="font-display text-2xl text-foreground leading-none truncate">{monitor.name}</h1>
                <a
                  href={monitor.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5"
                >
                  {monitor.url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                className="flex items-center gap-2 font-mono text-xs border border-border bg-card hover:border-primary/50 transition-colors px-3 py-2 rounded disabled:opacity-50"
                onClick={handlePing}
                disabled={triggerPing.isPending}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${triggerPing.isPending ? "animate-spin" : ""}`} />
                Test
              </button>
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs border-border bg-card hover:border-primary/50 h-8"
                onClick={openEdit}
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs border-border bg-card hover:border-primary/50 h-8"
                onClick={handleToggle}
                disabled={updateMonitor.isPending}
              >
                {monitor.active ? <Pause className="w-3.5 h-3.5 mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
                {monitor.active ? "Pause" : "Resume"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="font-mono text-xs h-8">
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display text-xl uppercase">Delete Monitor?</AlertDialogTitle>
                    <AlertDialogDescription className="font-mono text-sm text-muted-foreground">
                      This will permanently delete "{monitor.name}" and all its history. Cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-mono">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono">
                      Confirm Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {/* Top 3 stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Current status */}
          <div className="border border-border bg-card rounded p-5 space-y-1">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Current Status</div>
            {isDown ? (
              <>
                <div className="font-display text-4xl text-destructive leading-none">Down</div>
                {currentStatusDuration && (
                  <div className="font-mono text-xs text-muted-foreground">Down for {currentStatusDuration}</div>
                )}
                <Link href="/incidents">
                  <span className="inline-block font-mono text-[10px] text-primary hover:underline cursor-pointer mt-1">View Incident →</span>
                </Link>
              </>
            ) : isUp ? (
              <>
                <div className="font-display text-4xl text-primary leading-none">Up</div>
                {currentStatusDuration && (
                  <div className="font-mono text-xs text-muted-foreground">Operational for {currentStatusDuration}</div>
                )}
              </>
            ) : (
              <>
                <div className="font-display text-4xl text-muted-foreground leading-none">Unknown</div>
                <div className="font-mono text-xs text-muted-foreground">No ping yet</div>
              </>
            )}
          </div>

          {/* Last check */}
          <div className="border border-border bg-card rounded p-5 space-y-1">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Last Check</div>
            <div className="font-display text-2xl text-foreground leading-tight">
              {monitor.lastPingedAt
                ? formatDistanceToNow(new Date(monitor.lastPingedAt), { addSuffix: true })
                : "Never"}
            </div>
            <div className="font-mono text-xs text-muted-foreground">Checked every {monitor.intervalMinutes}m</div>
            {monitor.lastResponseTimeMs && (
              <div className="font-mono text-xs text-primary">{monitor.lastResponseTimeMs}ms response</div>
            )}
          </div>

          {/* Last 24 hours */}
          <div className="border border-border bg-card rounded p-5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Last 24 Hours</div>
              {stats && (
                <span className={`font-mono text-xs font-bold ${stats.last24hUptimePercent >= 99 ? "text-primary" : stats.last24hUptimePercent >= 95 ? "text-yellow-400" : "text-destructive"}`}>
                  {stats.last24hUptimePercent.toFixed(2)}%
                </span>
              )}
            </div>
            <UptimeBar pings={pings ?? []} />
            {stats && (
              <div className="font-mono text-[10px] text-muted-foreground">
                {stats.incidentCount24h > 0
                  ? `${stats.incidentCount24h} incident${stats.incidentCount24h !== 1 ? "s" : ""}`
                  : "No incidents"}
              </div>
            )}
          </div>
        </div>

        {/* Uptime windows row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <UptimeStat
              label="Last 7 Days"
              percent={stats.last7dUptimePercent ?? stats.last24hUptimePercent}
              incidents={stats.incidentCount7d ?? 0}
            />
            <UptimeStat
              label="Last 30 Days"
              percent={stats.last30dUptimePercent ?? stats.last24hUptimePercent}
              incidents={stats.incidentCount30d ?? 0}
            />
            <div className="border border-border bg-card rounded p-4 space-y-1">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Avg Response</div>
              <div className="font-display text-3xl leading-none text-foreground">
                {stats.avgResponseTimeMs ? `${Math.round(stats.avgResponseTimeMs)}ms` : "—"}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">{stats.totalPings} total pings</div>
            </div>
            <div className="border border-border bg-card rounded p-4 space-y-1">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Globe className="w-3 h-3" />
                Region
              </div>
              <div className="font-display text-xl leading-none text-foreground">Global</div>
              <div className="font-mono text-[10px] text-muted-foreground">HTTP/S monitor</div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {stats.upPings} up · {stats.downPings} down
              </div>
            </div>
          </div>
        )}

        {/* SSL certificate */}
        {(ssl.sslCheckEnabled || sslAvailable) && (
          <div className="border border-border bg-card rounded p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <ShieldCheck className={`w-5 h-5 mt-0.5 shrink-0 ${
                  ssl.sslStatus === "valid" ? "text-primary"
                  : ssl.sslStatus === "expiring" ? "text-yellow-400"
                  : ssl.sslStatus === "expired" || ssl.sslStatus === "error" ? "text-destructive"
                  : "text-muted-foreground"
                }`} />
                <div>
                  <h3 className="font-display text-base uppercase tracking-wide text-muted-foreground">SSL Certificate</h3>
                  {!ssl.sslCheckEnabled ? (
                    <p className="font-mono text-xs text-muted-foreground mt-1">Not monitored for this endpoint.</p>
                  ) : !ssl.sslLastCheckedAt ? (
                    <p className="font-mono text-xs text-muted-foreground mt-1">Awaiting first certificate check…</p>
                  ) : (
                    <div className="font-mono text-xs text-muted-foreground mt-1 space-y-0.5">
                      <div>
                        Status:{" "}
                        <span className={
                          ssl.sslStatus === "valid" ? "text-primary"
                          : ssl.sslStatus === "expiring" ? "text-yellow-400"
                          : "text-destructive"
                        }>
                          {ssl.sslStatus === "valid" ? "Valid"
                            : ssl.sslStatus === "expiring" ? "Expiring soon"
                            : ssl.sslStatus === "expired" ? "Expired"
                            : "Check error"}
                        </span>
                      </div>
                      {typeof ssl.sslDaysRemaining === "number" && (
                        <div>{ssl.sslDaysRemaining} day{ssl.sslDaysRemaining === 1 ? "" : "s"} until expiry</div>
                      )}
                      {ssl.sslExpiresAt && <div>Expires {format(new Date(ssl.sslExpiresAt), "MMM d, yyyy")}</div>}
                      {ssl.sslIssuer && <div>Issuer: {ssl.sslIssuer}</div>}
                      {ssl.sslLastCheckedAt && (
                        <div className="text-muted-foreground/60">Checked {formatDistanceToNow(new Date(ssl.sslLastCheckedAt), { addSuffix: true })}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {sslAvailable ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs border-border bg-card hover:border-primary/50 h-8"
                  onClick={handleToggleSsl}
                  disabled={updateMonitor.isPending}
                >
                  {ssl.sslCheckEnabled ? "Disable" : "Enable"}
                </Button>
              ) : (
                <Link href="/upgrade">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-primary hover:underline">
                    <Lock className="w-3 h-3" /> Upgrade to monitor SSL
                  </span>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Response time chart */}
        <div className="border border-border bg-card rounded p-5">
          <h3 className="font-display text-base uppercase tracking-wide text-muted-foreground mb-4">
            Response Time — All Regions
          </h3>
          <div className="h-[200px]">
            {chartData.filter(d => d.responseTime !== null).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="time" stroke="#333" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="#333" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${v}ms`} width={48} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "hsl(0 0% 6%)", borderColor: "hsl(0 0% 15%)", fontFamily: "var(--app-font-mono)", fontSize: "11px" }}
                    itemStyle={{ color: "hsl(var(--primary))" }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                    formatter={(value: number) => [`${value}ms`, "Response"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="responseTime"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: "hsl(var(--primary))" }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center font-mono text-sm text-muted-foreground">No data yet</div>
            )}
          </div>
        </div>

        {/* Ping log table */}
        <div className="border border-border bg-card rounded overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="font-display text-base uppercase tracking-wide text-muted-foreground">Recent Pings</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono text-left">
              <thead>
                <tr className="border-b border-border bg-card/40">
                  <th className="px-5 py-2.5 font-normal text-[10px] uppercase tracking-widest text-muted-foreground">Timestamp</th>
                  <th className="px-5 py-2.5 font-normal text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-5 py-2.5 font-normal text-[10px] uppercase tracking-widest text-muted-foreground">Response</th>
                  <th className="px-5 py-2.5 font-normal text-[10px] uppercase tracking-widest text-muted-foreground">Code</th>
                  <th className="px-5 py-2.5 font-normal text-[10px] uppercase tracking-widest text-muted-foreground">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pings?.slice(0, 25).map((ping) => (
                  <tr key={ping.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-2.5 whitespace-nowrap text-muted-foreground text-xs">
                      {format(new Date(ping.createdAt), "MMM d, HH:mm:ss")}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border ${ping.status === "up" ? "bg-primary/10 text-primary border-primary/25" : "bg-destructive/10 text-destructive border-destructive/25"}`}>
                        {ping.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-xs">
                      {ping.responseTimeMs ? <span className="text-primary">{ping.responseTimeMs}ms</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{ping.statusCode ?? "—"}</td>
                    <td className="px-5 py-2.5 text-destructive text-xs truncate max-w-[200px]">{ping.error ?? "—"}</td>
                  </tr>
                ))}
                {!pings?.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground font-mono text-sm">No logs yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Edit Monitor Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase tracking-wide">Edit Monitor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Name</label>
              <input
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="My Website"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">URL</label>
              <input
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                value={editUrl}
                onChange={e => setEditUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Ping Interval</label>
              <select
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                value={editInterval}
                onChange={e => setEditInterval(Number(e.target.value))}
              >
                {[1, 2, 3, 5, 10, 15, 30, 60]
                  .filter(v => v * 60 >= (user?.planLimits?.checkIntervalSeconds ?? 60) || v === monitor.intervalMinutes)
                  .map(v => (
                    <option key={v} value={v}>Every {v} minute{v !== 1 ? "s" : ""}</option>
                  ))}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              className="font-mono text-xs border border-border px-4 py-2 rounded hover:border-muted-foreground transition-colors"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
            <button
              className="font-mono text-xs bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
              onClick={handleEdit}
              disabled={updateMonitor.isPending || !editName.trim() || !editUrl.trim()}
            >
              {updateMonitor.isPending ? "Saving…" : "Save Changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
