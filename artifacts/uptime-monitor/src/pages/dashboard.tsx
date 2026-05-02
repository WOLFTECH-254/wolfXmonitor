import { Layout } from "@/components/layout";
import {
  useGetDashboardSummary,
  useListMonitors,
  useTriggerPing,
  useUpdateMonitor,
  getGetDashboardSummaryQueryKey,
  getListMonitorsQueryKey
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Activity, Clock, Server, CheckCircle2, XCircle, Play, Pause, RefreshCw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function StatusDot({ status, pinging }: { status: "up" | "down" | "unknown"; pinging?: boolean }) {
  if (pinging) return <span className="status-dot unknown animate-pulse" />;
  return <span className={`status-dot ${status}`} />;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({
    query: { refetchInterval: 30000 }
  });
  const { data: monitors, isLoading: isLoadingMonitors } = useListMonitors({
    query: { refetchInterval: 30000 }
  });

  const toggleMonitor = useUpdateMonitor();
  const triggerPing = useTriggerPing();

  const handleToggleActive = (id: number, currentActive: boolean) => {
    toggleMonitor.mutate({ id, data: { active: !currentActive } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Monitor updated", description: `Monitor is now ${!currentActive ? "active" : "paused"}.` });
      }
    });
  };

  const handlePing = (id: number) => {
    triggerPing.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Ping sent", description: "Successfully pinged the monitor." });
      }
    });
  };

  return (
    <Layout>
      <div className="space-y-8">

        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border">
          <div>
            <p className="font-mono text-xs text-primary uppercase tracking-widest mb-1">Overview</p>
            <h1 className="font-display text-5xl text-foreground leading-none tracking-wide uppercase">
              System Status
            </h1>
            <p className="text-muted-foreground font-mono mt-2 text-sm">
              Live view of all monitored endpoints.
            </p>
          </div>
          <Link href="/monitors/new">
            <button className="flex items-center gap-2 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-5 py-2.5 rounded font-bold tracking-wider group">
              Add Endpoint
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </Link>
        </div>

        {/* Summary stat cards */}
        {isLoadingSummary ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border border-border bg-card rounded p-5">
                <Skeleton className="h-3 w-20 mb-4" />
                <Skeleton className="h-10 w-12" />
              </div>
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Endpoints", value: summary.totalMonitors, icon: Server, color: "text-foreground" },
              { label: "Online", value: summary.monitorsUp, icon: CheckCircle2, color: "text-primary" },
              { label: "Offline", value: summary.monitorsDown, icon: XCircle, color: "text-destructive" },
              { label: "Global Uptime", value: `${summary.overallUptimePercent.toFixed(1)}%`, icon: Activity, color: "text-foreground" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="border border-border bg-card rounded p-5 card-hover">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
                  <Icon className={`w-4 h-4 ${color} opacity-60`} />
                </div>
                <div className={`font-display text-5xl leading-none ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Monitors list */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="status-dot up" />
            <h2 className="font-display text-2xl uppercase tracking-wide text-muted-foreground">Live Monitors</h2>
          </div>

          {isLoadingMonitors ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border border-border bg-card rounded p-4">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-3 w-72" />
                </div>
              ))}
            </div>
          ) : !monitors?.length ? (
            <div className="text-center py-16 border border-dashed border-border rounded bg-card/30">
              <Server className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="font-display text-2xl text-foreground mb-2 uppercase tracking-wide">No Monitors Yet</h3>
              <p className="text-sm font-mono text-muted-foreground mb-6">Add your first endpoint to start tracking uptime.</p>
              <Link href="/monitors/new">
                <button className="font-mono text-sm border border-primary/50 text-primary hover:bg-primary/10 transition-colors px-5 py-2 rounded tracking-wider">
                  Create Monitor
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {monitors.map(monitor => (
                <div
                  key={monitor.id}
                  className="border border-border bg-card rounded px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group card-hover"
                >
                  <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                    <StatusDot
                      status={monitor.active ? monitor.lastStatus : "unknown"}
                      pinging={triggerPing.isPending && triggerPing.variables?.id === monitor.id}
                    />
                    <div className="flex-1 min-w-0">
                      <Link href={`/monitors/${monitor.id}`}>
                        <h3 className="font-display text-xl text-foreground truncate hover:text-primary transition-colors cursor-pointer tracking-wide uppercase">
                          {monitor.name}
                        </h3>
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-mono text-muted-foreground">
                        <span className="truncate max-w-[200px] sm:max-w-[300px]">{monitor.url}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          every {monitor.intervalMinutes}m
                        </span>
                        {monitor.lastPingedAt && (
                          <span>pinged {formatDistanceToNow(new Date(monitor.lastPingedAt), { addSuffix: true })}</span>
                        )}
                        {!monitor.active && (
                          <span className="text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded text-[10px] tracking-widest">PAUSED</span>
                        )}
                        {monitor.lastResponseTimeMs && (
                          <span className="text-primary">{monitor.lastResponseTimeMs}ms</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-mono h-8 text-xs border-border bg-background hover:border-primary/50"
                      onClick={() => handlePing(monitor.id)}
                      disabled={triggerPing.isPending && triggerPing.variables?.id === monitor.id}
                    >
                      <RefreshCw className={`w-3 h-3 mr-1.5 ${triggerPing.isPending && triggerPing.variables?.id === monitor.id ? "animate-spin" : ""}`} />
                      Ping
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:text-primary"
                      onClick={() => handleToggleActive(monitor.id, monitor.active)}
                    >
                      {monitor.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Link href={`/monitors/${monitor.id}`}>
                      <Button variant="ghost" size="sm" className="font-mono h-8 text-xs hover:text-primary">
                        Details →
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
