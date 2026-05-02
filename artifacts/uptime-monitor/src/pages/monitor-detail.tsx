import { Layout } from "@/components/layout";
import { 
  useGetMonitor, 
  useGetMonitorPings, 
  useGetMonitorStats,
  useDeleteMonitor,
  useTriggerPing,
  getGetMonitorQueryKey,
  getGetMonitorPingsQueryKey,
  getGetMonitorStatsQueryKey,
  getListMonitorsQueryKey
} from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TerminalSquare, Activity, Server, Trash2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Cell } from "recharts";
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

  const { data: stats, isLoading: isLoadingStats } = useGetMonitorStats(id, {
    query: { enabled: !!id, refetchInterval: 30000 }
  });

  const { data: pings, isLoading: isLoadingPings } = useGetMonitorPings(id, { limit: 100 }, {
    query: { enabled: !!id, refetchInterval: 30000 }
  });

  const deleteMonitor = useDeleteMonitor();
  const triggerPing = useTriggerPing();

  const handleDelete = () => {
    deleteMonitor.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
        toast({ title: "Monitor deleted", description: "Endpoint removed." });
        setLocation("/");
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete monitor." });
      }
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

  if (isLoadingMonitor || !monitor) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-[300px] w-full" />
        </div>
      </Layout>
    );
  }

  // Process data for charts
  const reversedPings = pings ? [...pings].reverse() : [];
  
  const pingChartData = reversedPings.map(p => ({
    time: format(new Date(p.createdAt), "HH:mm"),
    status: p.status,
    responseTime: p.responseTimeMs || 0,
    fullDate: new Date(p.createdAt).toLocaleString(),
    error: p.error
  }));

  const statusClass = monitor.lastStatus === "up" ? "up" : monitor.lastStatus === "down" ? "down" : "unknown";

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-start gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full mt-1">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold font-mono tracking-tight text-foreground">{monitor.name}</h1>
                <span className={`status-dot ${statusClass}`} />
              </div>
              <a href={monitor.url} target="_blank" rel="noreferrer" className="text-muted-foreground font-mono text-sm mt-1 hover:text-primary transition-colors hover:underline">
                {monitor.url}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="font-mono bg-background"
              onClick={handlePing}
              disabled={triggerPing.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${triggerPing.isPending ? 'animate-spin' : ''}`} />
              Ping Now
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="font-mono">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-mono">Delete Monitor?</AlertDialogTitle>
                  <AlertDialogDescription className="font-mono text-muted-foreground">
                    This will permanently delete the endpoint "{monitor.name}" and all its ping history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-mono">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono">
                    DELETE_ENDPOINT
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6 bg-card border-border flex flex-col justify-between">
              <div className="text-muted-foreground font-mono text-xs uppercase tracking-wider mb-4">Uptime (24h)</div>
              <div className="text-4xl font-mono font-bold text-primary">
                {stats.last24hUptimePercent.toFixed(2)}%
              </div>
            </Card>
            <Card className="p-6 bg-card border-border flex flex-col justify-between">
              <div className="text-muted-foreground font-mono text-xs uppercase tracking-wider mb-4">Avg Response Time</div>
              <div className="text-4xl font-mono font-bold">
                {stats.avgResponseTimeMs ? `${Math.round(stats.avgResponseTimeMs)}ms` : '--'}
              </div>
            </Card>
            <Card className="p-6 bg-card border-border flex flex-col justify-between">
              <div className="text-muted-foreground font-mono text-xs uppercase tracking-wider mb-4">Last Checked</div>
              <div className="text-2xl font-mono font-bold mt-2">
                {monitor.lastPingedAt ? formatDistanceToNow(new Date(monitor.lastPingedAt), { addSuffix: true }) : 'Never'}
              </div>
            </Card>
            <Card className="p-6 bg-card border-border flex flex-col justify-between">
              <div className="text-muted-foreground font-mono text-xs uppercase tracking-wider mb-4">Total Pings</div>
              <div className="text-4xl font-mono font-bold">{stats.totalPings}</div>
              <div className="text-xs font-mono text-muted-foreground mt-2">
                <span className="text-primary font-bold">{stats.upPings} up</span> <span className="opacity-50">/</span> <span className="text-destructive font-bold">{stats.downPings} down</span>
              </div>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 bg-card border-border">
            <h3 className="font-mono font-bold mb-6 flex items-center gap-2 text-muted-foreground uppercase text-sm tracking-wider">
              <Activity className="w-4 h-4" /> Response Time History
            </h3>
            <div className="h-[250px] w-full">
              {pingChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pingChartData}>
                    <XAxis 
                      dataKey="time" 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}ms`}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontFamily: 'var(--app-font-mono)', fontSize: '12px' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                      formatter={(value: number) => [`${value}ms`, 'Response Time']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                  No ping history yet
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <h3 className="font-mono font-bold mb-6 flex items-center gap-2 text-muted-foreground uppercase text-sm tracking-wider">
              <Server className="w-4 h-4" /> Uptime History
            </h3>
            <div className="h-[250px] w-full">
              {pingChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pingChartData} barGap={2}>
                    <XAxis 
                      dataKey="time" 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontFamily: 'var(--app-font-mono)', fontSize: '12px' }}
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      formatter={(value: any, name: string, props: any) => {
                        if (name === "status") return [props.payload.status.toUpperCase(), 'Status'];
                        return [value, name];
                      }}
                    />
                    <Bar dataKey="responseTime" radius={[2, 2, 0, 0]} maxBarSize={40}>
                      {pingChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.status === 'up' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                  No ping history yet
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card className="border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/20">
            <h3 className="font-mono font-bold text-sm uppercase tracking-wider text-muted-foreground">Recent Ping Logs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono text-left">
              <thead className="bg-muted/10 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-normal">Timestamp</th>
                  <th className="px-6 py-3 font-normal">Status</th>
                  <th className="px-6 py-3 font-normal">Response Time</th>
                  <th className="px-6 py-3 font-normal">Code</th>
                  <th className="px-6 py-3 font-normal">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pings?.slice(0, 15).map((ping) => (
                  <tr key={ping.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap text-muted-foreground">
                      {format(new Date(ping.createdAt), "MMM d, HH:mm:ss")}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold tracking-wider ${ping.status === 'up' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                        {ping.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {ping.responseTimeMs ? `${ping.responseTimeMs}ms` : '--'}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {ping.statusCode || '--'}
                    </td>
                    <td className="px-6 py-3 text-destructive truncate max-w-xs">
                      {ping.error || '--'}
                    </td>
                  </tr>
                ))}
                {!pings?.length && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No logs available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </Layout>
  );
}
