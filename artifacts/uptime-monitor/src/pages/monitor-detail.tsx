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
import { ArrowLeft, Activity, Server, Trash2, RefreshCw, Pause, Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, Cell
} from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function MonitorDetail() {
  const { id: idStr } = useParams();
  const id = Number(idStr);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const handleDelete = () => {
    deleteMonitor.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
        toast({ title: "Monitor deleted", description: "Endpoint removed." });
        setLocation("/dashboard");
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
        toast({ title: "Ping sent", description: "Successfully pinged the monitor." });
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

  if (isLoadingMonitor || !monitor) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-14 w-1/2" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded" />)}
          </div>
          <Skeleton className="h-[280px] w-full rounded" />
        </div>
      </Layout>
    );
  }

  const reversedPings = pings ? [...pings].reverse() : [];
  const pingChartData = reversedPings.map(p => ({
    time: format(new Date(p.createdAt), "HH:mm"),
    status: p.status,
    responseTime: p.responseTimeMs ?? 0,
    fullDate: new Date(p.createdAt).toLocaleString(),
    error: p.error
  }));

  const statusClass = monitor.lastStatus === "up" ? "up" : monitor.lastStatus === "down" ? "down" : "unknown";

  return (
    <Layout>
      <div className="space-y-8">

        {/* Header */}
        <div className="pb-6 border-b border-border">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/dashboard">
              <button className="w-8 h-8 rounded border border-border bg-card hover:border-primary/50 flex items-center justify-center transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <p className="font-mono text-xs text-primary uppercase tracking-widest">Monitor Detail</p>
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-display text-5xl uppercase tracking-wide text-foreground leading-none">
                  {monitor.name}
                </h1>
                <span className={`status-dot ${statusClass}`} />
              </div>
              <a
                href={monitor.url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {monitor.url}
              </a>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="font-mono border-border bg-card hover:border-primary/50 h-9"
                onClick={handleToggle}
                disabled={updateMonitor.isPending}
              >
                {monitor.active ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {monitor.active ? "Pause" : "Resume"}
              </Button>
              <button
                className="flex items-center gap-2 font-mono text-sm border border-border bg-card hover:border-primary/50 transition-colors px-4 py-2 rounded disabled:opacity-50"
                onClick={handlePing}
                disabled={triggerPing.isPending}
              >
                <RefreshCw className={`w-4 h-4 ${triggerPing.isPending ? "animate-spin" : ""}`} />
                Ping Now
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="font-mono h-9">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display text-2xl uppercase tracking-wide">Delete Monitor?</AlertDialogTitle>
                    <AlertDialogDescription className="font-mono text-sm text-muted-foreground">
                      This will permanently delete "{monitor.name}" and all its ping history. This cannot be undone.
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

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Uptime (24h)", value: `${stats.last24hUptimePercent.toFixed(1)}%`, color: "text-primary" },
              { label: "Avg Response", value: stats.avgResponseTimeMs ? `${Math.round(stats.avgResponseTimeMs)}ms` : "--", color: "text-foreground" },
              { label: "Last Checked", value: monitor.lastPingedAt ? formatDistanceToNow(new Date(monitor.lastPingedAt), { addSuffix: true }) : "Never", color: "text-foreground", small: true },
              { label: "Total Pings", value: stats.totalPings, color: "text-foreground" },
            ].map(({ label, value, color, small }) => (
              <div key={label} className="border border-border bg-card rounded p-5 card-hover">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">{label}</div>
                <div className={`font-display leading-none ${color} ${small ? "text-2xl mt-1" : "text-5xl"}`}>{value}</div>
                {label === "Total Pings" && (
                  <div className="font-mono text-xs text-muted-foreground mt-2">
                    <span className="text-primary">{stats.upPings} up</span>
                    <span className="mx-1 opacity-30">/</span>
                    <span className="text-destructive">{stats.downPings} down</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-border bg-card rounded p-6 card-hover">
            <h3 className="font-display text-xl uppercase tracking-wide text-muted-foreground mb-5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Response Time
            </h3>
            <div className="h-[240px]">
              {pingChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pingChartData}>
                    <XAxis dataKey="time" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}ms`} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(0 0% 6%)", borderColor: "hsl(0 0% 15%)", fontFamily: "var(--app-font-mono)", fontSize: "11px" }}
                      itemStyle={{ color: "hsl(var(--primary))" }}
                      labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                      formatter={(value: number) => [`${value}ms`, "Response"]}
                    />
                    <Line type="monotone" dataKey="responseTime" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "hsl(var(--primary))" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center font-mono text-sm text-muted-foreground">No data yet</div>
              )}
            </div>
          </div>

          <div className="border border-border bg-card rounded p-6 card-hover">
            <h3 className="font-display text-xl uppercase tracking-wide text-muted-foreground mb-5 flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Uptime History
            </h3>
            <div className="h-[240px]">
              {pingChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pingChartData} barGap={1}>
                    <XAxis dataKey="time" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(0 0% 6%)", borderColor: "hsl(0 0% 15%)", fontFamily: "var(--app-font-mono)", fontSize: "11px" }}
                      cursor={{ fill: "hsl(0 0% 10%)" }}
                      formatter={(value: unknown, _: string, props: { payload?: { status: string } }) => [
                        props.payload?.status?.toUpperCase() ?? "--",
                        "Status"
                      ]}
                    />
                    <Bar dataKey="responseTime" radius={[2, 2, 0, 0]} maxBarSize={16}>
                      {pingChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.status === "up" ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center font-mono text-sm text-muted-foreground">No data yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Ping log table */}
        <div className="border border-border bg-card rounded overflow-hidden card-hover">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <h3 className="font-display text-xl uppercase tracking-wide text-muted-foreground">Recent Ping Logs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-normal text-[10px] uppercase tracking-widest text-muted-foreground">Timestamp</th>
                  <th className="px-5 py-3 font-normal text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-5 py-3 font-normal text-[10px] uppercase tracking-widest text-muted-foreground">Response</th>
                  <th className="px-5 py-3 font-normal text-[10px] uppercase tracking-widest text-muted-foreground">Code</th>
                  <th className="px-5 py-3 font-normal text-[10px] uppercase tracking-widest text-muted-foreground">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pings?.slice(0, 20).map((ping) => (
                  <tr key={ping.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-muted-foreground text-xs">
                      {format(new Date(ping.createdAt), "MMM d, HH:mm:ss")}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border ${ping.status === "up" ? "bg-primary/10 text-primary border-primary/25" : "bg-destructive/10 text-destructive border-destructive/25"}`}>
                        {ping.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-xs">
                      {ping.responseTimeMs ? <span className="text-primary">{ping.responseTimeMs}ms</span> : <span className="text-muted-foreground">--</span>}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {ping.statusCode ?? "--"}
                    </td>
                    <td className="px-5 py-3 text-destructive text-xs truncate max-w-[200px]">
                      {ping.error ?? "--"}
                    </td>
                  </tr>
                ))}
                {!pings?.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground font-mono text-sm">
                      No logs available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </Layout>
  );
}
