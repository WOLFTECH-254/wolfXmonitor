import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout";
import { useListMonitors, useTriggerPing, useUpdateMonitor, getListMonitorsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, RefreshCw, Pause, Play, ArrowRight, Server, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function StatusBadge({ status, active }: { status: "up" | "down" | "unknown"; active: boolean }) {
  if (!active) return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-yellow-400 uppercase tracking-widest">
      <span className="w-2 h-2 rounded-full bg-yellow-400/60" />
      Paused
    </span>
  );
  if (status === "up") return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-primary uppercase tracking-widest">
      <span className="w-2 h-2 rounded-full bg-primary" />
      Up
    </span>
  );
  if (status === "down") return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-destructive uppercase tracking-widest animate-pulse">
      <span className="w-2 h-2 rounded-full bg-destructive" />
      Down
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
      <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
      Unknown
    </span>
  );
}

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: monitors, isLoading } = useListMonitors({ query: { refetchInterval: 30000 } });
  const triggerPing = useTriggerPing();
  const updateMonitor = useUpdateMonitor();

  const handlePing = (id: number) => {
    triggerPing.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Ping sent", description: "Monitor pinged successfully." });
      }
    });
  };

  const handleToggle = (id: number, active: boolean) => {
    updateMonitor.mutate({ id, data: { active: !active } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Monitor updated", description: `Monitor is now ${!active ? "active" : "paused"}.` });
      }
    });
  };

  const up = monitors?.filter(m => m.active && m.lastStatus === "up").length ?? 0;
  const down = monitors?.filter(m => m.active && m.lastStatus === "down").length ?? 0;

  return (
    <Layout>
      <Helmet>
        <title>Monitors — wolfXmonitor</title>
        <meta name="description" content="Manage all your uptime monitors, pause, resume, or add new ones." />
      </Helmet>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap pb-5 border-b border-border">
          <div>
            <h1 className="font-display text-3xl text-foreground">
              Monitoring<span className="text-primary">.</span>
            </h1>
            {!isLoading && monitors && (
              <p className="font-mono text-xs text-muted-foreground mt-1">
                {monitors.length} monitor{monitors.length !== 1 ? "s" : ""}
                {down > 0
                  ? <span className="text-destructive ml-2">· {down} down</span>
                  : <span className="text-primary ml-2">· {up} operational</span>}
              </p>
            )}
          </div>
          <Link href="/monitors/new">
            <Button className="font-mono text-sm h-9 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Add Monitor
            </Button>
          </Link>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border border-border bg-card rounded p-4">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-72" />
              </div>
            ))}
          </div>
        ) : !monitors?.length ? (
          <div className="text-center py-20 border border-dashed border-border rounded bg-card/20">
            <Server className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="font-display text-2xl text-foreground mb-2 uppercase tracking-wide">No Monitors Yet</h3>
            <p className="text-sm font-mono text-muted-foreground mb-6">Start tracking your first endpoint now.</p>
            <Link href="/monitors/new">
              <button className="font-mono text-sm border border-primary/50 text-primary hover:bg-primary/10 transition-colors px-5 py-2 rounded tracking-wider">
                Create Monitor
              </button>
            </Link>
          </div>
        ) : (
          <div className="rounded border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card/60">
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 w-24">Status</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3">Monitor</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 hidden md:table-cell w-28">Interval</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 hidden lg:table-cell w-36">Last Check</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 hidden md:table-cell w-28">Response</th>
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-right px-4 py-3 w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {monitors.map((monitor, idx) => {
                  const isPinging = triggerPing.isPending && triggerPing.variables?.id === monitor.id;
                  return (
                    <tr
                      key={monitor.id}
                      className={`border-b border-border last:border-0 transition-colors hover:bg-card/40 group ${idx % 2 === 0 ? "bg-background" : "bg-card/20"}`}
                    >
                      <td className="px-4 py-3.5">
                        <StatusBadge status={monitor.lastStatus} active={monitor.active} />
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/monitors/${monitor.id}`}>
                          <div className="font-mono text-sm text-foreground font-medium hover:text-primary transition-colors cursor-pointer">
                            {monitor.name}
                          </div>
                        </Link>
                        <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[240px] mt-0.5">
                          {monitor.url}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="font-mono text-xs text-muted-foreground">every {monitor.intervalMinutes}m</span>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className="font-mono text-xs text-muted-foreground">
                          {monitor.lastPingedAt
                            ? formatDistanceToNow(new Date(monitor.lastPingedAt), { addSuffix: true })
                            : "Never"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {monitor.lastResponseTimeMs ? (
                          <span className={`font-mono text-xs ${monitor.lastResponseTimeMs > 2000 ? "text-yellow-400" : "text-primary"}`}>
                            {monitor.lastResponseTimeMs}ms
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground disabled:opacity-40"
                            onClick={() => handlePing(monitor.id)}
                            disabled={isPinging}
                            title="Ping now"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? "animate-spin" : ""}`} />
                          </button>
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
                            onClick={() => handleToggle(monitor.id, monitor.active)}
                            title={monitor.active ? "Pause" : "Resume"}
                          >
                            {monitor.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <Link href={`/monitors/${monitor.id}`}>
                            <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground" title="View details">
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {monitors && monitors.length > 0 && (
          <div className="flex items-center gap-4 text-center justify-center py-2">
            <span className="inline-flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
              <Activity className="w-3 h-3 text-primary" />
              Auto-refreshes every 30s
            </span>
          </div>
        )}
      </div>
    </Layout>
  );
}
