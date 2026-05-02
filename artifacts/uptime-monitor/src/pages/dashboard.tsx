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
import { Activity, Clock, Server, CheckCircle2, XCircle, Play, Pause, RefreshCw, TerminalSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function StatusDot({ status, pinging }: { status: "up" | "down" | "unknown", pinging?: boolean }) {
  if (pinging) {
    return <span className="status-dot unknown animate-pulse" />;
  }
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
        toast({
          title: "Monitor updated",
          description: `Monitor is now ${!currentActive ? 'active' : 'paused'}.`,
        });
      }
    });
  };

  const handlePing = (id: number) => {
    triggerPing.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({
          title: "Ping sent",
          description: "Successfully pinged the monitor.",
        });
      }
    });
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-mono tracking-tight text-foreground">SYSTEM_STATUS</h1>
            <p className="text-muted-foreground font-mono mt-1 text-sm">Monitoring configured endpoints.</p>
          </div>
          <Link href="/monitors/new">
            <Button className="font-mono">Add Endpoint</Button>
          </Link>
        </div>

        {isLoadingSummary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6 bg-card border-border">
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-16" />
              </Card>
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6 bg-card border-border flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground mb-4">
                <span className="font-mono text-xs uppercase tracking-wider">Total Endpoints</span>
                <Server className="w-4 h-4" />
              </div>
              <div className="text-4xl font-mono font-bold">{summary.totalMonitors}</div>
            </Card>
            <Card className="p-6 bg-card border-border flex flex-col justify-between">
              <div className="flex items-center justify-between text-primary mb-4">
                <span className="font-mono text-xs uppercase tracking-wider">Systems Online</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-4xl font-mono font-bold text-primary">{summary.monitorsUp}</div>
            </Card>
            <Card className="p-6 bg-card border-border flex flex-col justify-between">
              <div className="flex items-center justify-between text-destructive mb-4">
                <span className="font-mono text-xs uppercase tracking-wider">Systems Offline</span>
                <XCircle className="w-4 h-4" />
              </div>
              <div className="text-4xl font-mono font-bold text-destructive">{summary.monitorsDown}</div>
            </Card>
            <Card className="p-6 bg-card border-border flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground mb-4">
                <span className="font-mono text-xs uppercase tracking-wider">Global Uptime</span>
                <Activity className="w-4 h-4" />
              </div>
              <div className="text-4xl font-mono font-bold">
                {summary.overallUptimePercent.toFixed(2)}%
              </div>
            </Card>
          </div>
        ) : null}

        <div>
          <h2 className="text-lg font-mono font-bold mb-4 flex items-center gap-2 border-b border-border pb-2 text-muted-foreground">
            <TerminalSquare className="w-5 h-5 text-primary" />
            LIVE_MONITORS
          </h2>
          
          {isLoadingMonitors ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !monitors?.length ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg bg-card/30">
              <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-mono text-foreground mb-2">No monitors configured</h3>
              <p className="text-sm font-mono text-muted-foreground mb-4">Add your first endpoint to start tracking uptime.</p>
              <Link href="/monitors/new">
                <Button variant="outline" className="font-mono">Create Monitor</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {monitors.map(monitor => (
                <Card key={monitor.id} className="p-4 bg-card hover:bg-card/80 transition-colors border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                  <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                    <div className="mt-1 sm:mt-0 flex-shrink-0">
                      <StatusDot 
                        status={monitor.active ? monitor.lastStatus : "unknown"} 
                        pinging={triggerPing.isPending && triggerPing.variables?.id === monitor.id}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/monitors/${monitor.id}`}>
                        <h3 className="font-mono font-bold text-foreground truncate hover:text-primary transition-colors cursor-pointer text-lg">
                          {monitor.name}
                        </h3>
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-mono text-muted-foreground">
                        <span className="truncate max-w-[200px] sm:max-w-[300px]">{monitor.url}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {monitor.intervalMinutes}m
                        </span>
                        {monitor.lastPingedAt && (
                          <span>
                            Last ping: {formatDistanceToNow(new Date(monitor.lastPingedAt), { addSuffix: true })}
                          </span>
                        )}
                        {!monitor.active && (
                          <span className="text-yellow-600 bg-yellow-600/10 px-1.5 py-0.5 rounded">PAUSED</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="font-mono h-8 bg-background"
                      onClick={() => handlePing(monitor.id)}
                      disabled={triggerPing.isPending && triggerPing.variables?.id === monitor.id}
                    >
                      <RefreshCw className={`w-3 h-3 mr-2 ${triggerPing.isPending && triggerPing.variables?.id === monitor.id ? 'animate-spin' : ''}`} />
                      Ping
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={() => handleToggleActive(monitor.id, monitor.active)}
                    >
                      {monitor.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Link href={`/monitors/${monitor.id}`}>
                      <Button variant="ghost" size="sm" className="font-mono h-8">
                        Details
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
