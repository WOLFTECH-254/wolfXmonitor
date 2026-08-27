import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout";
import {
  useListMonitors,
  useTriggerPing,
  useUpdateMonitor,
  useDeleteMonitor,
  getListMonitorsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { Link, useSearch, useLocation } from "wouter";
import {
  Plus,
  RefreshCw,
  Pause,
  Play,
  ArrowRight,
  Server,
  Search,
  Trash2,
  ArrowUpDown,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import { MonitorFormDialog } from "@/components/monitor-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Status = "up" | "down" | "unknown";
type Filter = "all" | "up" | "down" | "paused";
type SortKey = "name" | "status" | "response" | "checked";

function StatusBadge({ status, active }: { status: Status; active: boolean }) {
  const map = !active
    ? { c: "text-yellow-400", d: "bg-yellow-400/60", t: "Paused" }
    : status === "up"
    ? { c: "text-primary", d: "bg-primary", t: "Up" }
    : status === "down"
    ? { c: "text-destructive", d: "bg-destructive", t: "Down" }
    : { c: "text-muted-foreground", d: "bg-muted-foreground/40", t: "Unknown" };
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest ${map.c}`}>
      <span className={`w-2 h-2 rounded-full ${map.d}`} />
      {map.t}
    </span>
  );
}

function SortHeader({
  label,
  k,
  sort,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  dir: 1 | -1;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort === k;
  return (
    <th className={`font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 ${className}`}>
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? "opacity-100" : "opacity-30"}`} />
        {active && <span className="text-[8px]">{dir === 1 ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const search = useSearch();
  const [, setLocation] = useLocation();

  const { data: monitors, isLoading, isFetching } = useListMonitors({ query: { refetchInterval: 30000 } });
  const triggerPing = useTriggerPing();
  const updateMonitor = useUpdateMonitor();
  const deleteMonitor = useDeleteMonitor();

  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("status");
  const [dir, setDir] = useState<1 | -1>(1);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  // Open the dialog when arriving via /monitors/new (redirect) or ?new=1
  useEffect(() => {
    if (new URLSearchParams(search).get("new") !== null) {
      setAddOpen(true);
      setLocation("/monitoring", { replace: true });
    }
  }, [search, setLocation]);

  // Keyboard: "n" adds a monitor
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "n" && !addOpen && !confirmDelete) {
        const el = document.activeElement;
        if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
        e.preventDefault();
        setAddOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addOpen, confirmDelete]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const handlePing = (id: number, name: string) => {
    triggerPing.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: "Pinged", description: `${name} checked.` }); },
      onError: () => toast({ variant: "destructive", title: "Ping failed", description: name }),
    });
  };

  const handleToggle = (id: number, active: boolean, name: string) => {
    updateMonitor.mutate({ id, data: { active: !active } }, {
      onSuccess: () => { invalidate(); toast({ title: active ? "Paused" : "Resumed", description: name }); },
    });
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    const { id, name } = confirmDelete;
    deleteMonitor.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: "Deleted", description: `${name} removed.` }); setConfirmDelete(null); },
      onError: () => toast({ variant: "destructive", title: "Delete failed", description: name }),
    });
  };

  const pingAll = () => {
    const active = (monitors ?? []).filter((m) => m.active);
    if (!active.length) return;
    active.forEach((m) => triggerPing.mutate({ id: m.id }));
    toast({ title: "Pinging all", description: `${active.length} monitor${active.length !== 1 ? "s" : ""} queued.` });
    setTimeout(invalidate, 1500);
  };

  const counts = useMemo(() => {
    const list = monitors ?? [];
    return {
      all: list.length,
      up: list.filter((m) => m.active && m.lastStatus === "up").length,
      down: list.filter((m) => m.active && m.lastStatus === "down").length,
      paused: list.filter((m) => !m.active).length,
    };
  }, [monitors]);

  const visible = useMemo(() => {
    let list = [...(monitors ?? [])];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.url.toLowerCase().includes(q));
    }
    if (filter === "up") list = list.filter((m) => m.active && m.lastStatus === "up");
    else if (filter === "down") list = list.filter((m) => m.active && m.lastStatus === "down");
    else if (filter === "paused") list = list.filter((m) => !m.active);

    const rank = (m: (typeof list)[number]) =>
      !m.active ? 3 : m.lastStatus === "down" ? 0 : m.lastStatus === "up" ? 2 : 1;
    list.sort((a, b) => {
      let c = 0;
      if (sort === "name") c = a.name.localeCompare(b.name);
      else if (sort === "status") c = rank(a) - rank(b);
      else if (sort === "response") c = (a.lastResponseTimeMs ?? 1e9) - (b.lastResponseTimeMs ?? 1e9);
      else if (sort === "checked")
        c = (a.lastPingedAt ? +new Date(a.lastPingedAt) : 0) - (b.lastPingedAt ? +new Date(b.lastPingedAt) : 0);
      return c * dir;
    });
    return list;
  }, [monitors, query, filter, sort, dir]);

  const onSort = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === 1 ? -1 : 1));
    else { setSort(k); setDir(1); }
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: `All ${counts.all}` },
    { key: "up", label: `Up ${counts.up}` },
    { key: "down", label: `Down ${counts.down}` },
    { key: "paused", label: `Paused ${counts.paused}` },
  ];

  return (
    <Layout>
      <Helmet>
        <title>Monitors — GuardiX</title>
        <meta name="description" content="Manage all your uptime monitors — add, pause, ping, and remove endpoints." />
      </Helmet>

      <MonitorFormDialog open={addOpen} onOpenChange={setAddOpen} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display tracking-wide">Delete monitor?</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              <span className="text-foreground">{confirmDelete?.name}</span> and all its ping history will be
              permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMonitor.isPending}
              className="font-mono text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMonitor.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap pb-5 border-b border-border">
          <div>
            <h1 className="font-display text-3xl text-foreground">
              Monitors<span className="text-primary">.</span>
            </h1>
            {!isLoading && monitors && (
              <p className="font-mono text-xs text-muted-foreground mt-1">
                {counts.all} monitor{counts.all !== 1 ? "s" : ""}
                {counts.down > 0 ? (
                  <span className="text-destructive ml-2">· {counts.down} down</span>
                ) : (
                  <span className="text-primary ml-2">· all operational</span>
                )}
                <span className={`ml-2 inline-flex items-center gap-1 ${isFetching ? "text-primary" : "text-muted-foreground/50"}`}>
                  <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} /> live
                </span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {counts.all > 1 && (
              <Button
                variant="outline"
                onClick={pingAll}
                className="font-mono text-sm h-9 border-border bg-background hover:border-primary/50"
              >
                <Zap className="w-4 h-4 mr-2" /> Ping all
              </Button>
            )}
            <Button
              onClick={() => setAddOpen(true)}
              className="font-mono text-sm h-9 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" /> Add monitor
            </Button>
          </div>
        </div>

        {/* Controls */}
        {!isLoading && counts.all > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
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
            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name or URL…"
                className="w-full bg-card border border-border rounded-md pl-9 pr-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border border-border bg-card rounded-lg p-4">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-72" />
              </div>
            ))}
          </div>
        ) : !counts.all ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg bg-card/20">
            <Server className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="font-display text-2xl text-foreground mb-2">No monitors yet</h3>
            <p className="text-sm font-mono text-muted-foreground mb-6">Add your first endpoint to start tracking uptime.</p>
            <Button onClick={() => setAddOpen(true)} className="font-mono bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Add monitor
            </Button>
          </div>
        ) : !visible.length ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card/20">
            <p className="font-mono text-sm text-muted-foreground">No monitors match “{query}” / {filter}.</p>
            <button
              onClick={() => { setQuery(""); setFilter("all"); }}
              className="font-mono text-xs text-primary hover:underline mt-2"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border bg-card/60">
                  <SortHeader label="Status" k="status" sort={sort} dir={dir} onSort={onSort} className="w-24" />
                  <SortHeader label="Monitor" k="name" sort={sort} dir={dir} onSort={onSort} />
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-left px-4 py-3 hidden md:table-cell w-24">Interval</th>
                  <SortHeader label="Last check" k="checked" sort={sort} dir={dir} onSort={onSort} className="hidden lg:table-cell w-36" />
                  <SortHeader label="Response" k="response" sort={sort} dir={dir} onSort={onSort} className="hidden md:table-cell w-28" />
                  <th className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-right px-4 py-3 w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((monitor, idx) => {
                  const isPinging = triggerPing.isPending && triggerPing.variables?.id === monitor.id;
                  const isToggling = updateMonitor.isPending && updateMonitor.variables?.id === monitor.id;
                  return (
                    <tr
                      key={monitor.id}
                      className={`border-b border-border last:border-0 transition-colors hover:bg-card/50 group ${idx % 2 === 0 ? "bg-background" : "bg-card/20"}`}
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
                        <div className="flex items-center justify-end gap-1 sm:opacity-40 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground disabled:opacity-40"
                            onClick={() => handlePing(monitor.id, monitor.name)}
                            disabled={isPinging}
                            title="Ping now"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? "animate-spin" : ""}`} />
                          </button>
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground disabled:opacity-40"
                            onClick={() => handleToggle(monitor.id, monitor.active, monitor.name)}
                            disabled={isToggling}
                            title={monitor.active ? "Pause" : "Resume"}
                          >
                            {monitor.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                            onClick={() => setConfirmDelete({ id: monitor.id, name: monitor.name })}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {counts.all > 0 && (
          <p className="font-mono text-[10px] text-muted-foreground/60 text-center">
            Auto-refreshes every 30s · press <kbd className="px-1 border border-border rounded">N</kbd> to add
          </p>
        )}
      </div>
    </Layout>
  );
}
