import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Users, Server, Trash2, Pause, Play, ShieldCheck, RefreshCw, Globe, CheckCircle2, XCircle, Mail, Eye, EyeOff, Send } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

interface AdminStats {
  totalUsers: number; totalMonitors: number; totalPings: number;
  monitorsUp: number; monitorsDown: number; monitorsUnknown: number;
  globalUptime: number;
}
interface AdminUser {
  id: number; name: string; email: string; isAdmin: boolean;
  notificationsEnabled: boolean; monitorCount: number; createdAt: string;
}
interface AdminMonitor {
  id: number; name: string; url: string; intervalMinutes: number;
  active: boolean; lastStatus: string; lastPingedAt: string | null;
  lastResponseTimeMs: number | null; userId: number | null;
  userName: string | null; userEmail: string | null; createdAt: string;
}
interface ActivityEntry {
  id: number; status: string; responseTimeMs: number | null;
  statusCode: number | null; error: string | null; createdAt: string;
  monitorId: number | null; monitorName: string | null;
  monitorUrl: string | null; userName: string | null;
}
interface EmailSettings {
  brevoApiKeySet: boolean;
  brevoApiKeyMasked: string;
  senderEmail: string;
  senderName: string;
}

type Tab = "overview" | "monitors" | "users" | "activity" | "settings";

function EmailSettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [brevoApiKey, setBrevoApiKey] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [testError, setTestError] = useState("");

  const { data: emailSettings, isLoading } = useQuery<EmailSettings>({
    queryKey: ["admin-email-settings"],
    queryFn: () => apiFetch("/api/admin/settings/email"),
  });

  useEffect(() => {
    if (emailSettings) {
      setSenderEmail(emailSettings.senderEmail);
      setSenderName(emailSettings.senderName);
      if (emailSettings.brevoApiKeySet && !brevoApiKey) {
        setBrevoApiKey(emailSettings.brevoApiKeyMasked);
      }
    }
  }, [emailSettings]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/settings/email", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brevoApiKey, senderEmail, senderName }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-email-settings"] });
      toast({ title: "Settings saved", description: "Email configuration updated." });
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to save settings." }),
  });

  const testConnection = async () => {
    setTestStatus("sending");
    setTestError("");
    try {
      const res = await fetch(`${BASE}/api/admin/settings/email/test`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setTestStatus("error");
        setTestError(data.error ?? "Unknown error");
      } else {
        setTestStatus("ok");
        toast({ title: "Test email sent!", description: "Check your inbox for the test message." });
      }
    } catch (e) {
      setTestStatus("error");
      setTestError(String(e));
    }
    setTimeout(() => setTestStatus("idle"), 6000);
  };

  if (isLoading) return <div className="font-mono text-xs text-muted-foreground py-10 text-center">Loading…</div>;

  return (
    <div className="max-w-xl space-y-6">
      <div className="border border-border bg-card rounded p-6 space-y-5">
        <div>
          <h3 className="font-display text-2xl uppercase tracking-wide text-foreground mb-1">Brevo Configuration</h3>
          <p className="font-mono text-xs text-muted-foreground">Set your Brevo API key and sender details. Changes take effect immediately — no server restart needed.</p>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Brevo API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={brevoApiKey}
              onChange={(e) => setBrevoApiKey(e.target.value)}
              onFocus={() => {
                if (brevoApiKey === emailSettings?.brevoApiKeyMasked) setBrevoApiKey("");
              }}
              onBlur={() => {
                if (!brevoApiKey && emailSettings?.brevoApiKeySet) {
                  setBrevoApiKey(emailSettings.brevoApiKeyMasked);
                }
              }}
              placeholder="xkeysib-…"
              className="w-full bg-background border border-border rounded px-3 py-2.5 pr-10 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {emailSettings?.brevoApiKeySet && (
            <p className="font-mono text-[10px] text-primary">
              ✓ Key configured. Leave unchanged to keep existing key.
            </p>
          )}
        </div>

        {/* Sender Name */}
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Sender Name
          </label>
          <input
            type="text"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="wolfXmonitor"
            className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Sender Email */}
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Sender Email
          </label>
          <input
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            placeholder="alerts@yourdomain.com"
            className="w-full bg-background border border-border rounded px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors"
          />
          <p className="font-mono text-[10px] text-muted-foreground">Must be from a domain verified in your Brevo account.</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="font-mono text-xs uppercase tracking-widest"
          >
            {save.isPending ? "Saving…" : "Save Settings"}
          </Button>

          <Button
            variant="outline"
            onClick={testConnection}
            disabled={testStatus === "sending" || !emailSettings?.brevoApiKeySet}
            className="font-mono text-xs uppercase tracking-widest flex items-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            {testStatus === "sending" ? "Sending…" : "Test Connection"}
          </Button>
        </div>

        {/* Test result */}
        {testStatus === "ok" && (
          <div className="flex items-center gap-2 font-mono text-xs text-primary border border-primary/25 bg-primary/5 rounded px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Test email sent — check your inbox.
          </div>
        )}
        {testStatus === "error" && (
          <div className="font-mono text-xs text-destructive border border-destructive/25 bg-destructive/5 rounded px-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              Connection failed
            </div>
            <div className="text-destructive/70 pl-5">{testError}</div>
          </div>
        )}
      </div>

      {/* Status card */}
      <div className="border border-border bg-card rounded p-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Current Status</div>
        <div className="space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">API Key</span>
            <span className={emailSettings?.brevoApiKeySet ? "text-primary" : "text-destructive"}>
              {emailSettings?.brevoApiKeySet ? "✓ Configured" : "✗ Not set"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Sender</span>
            <span className="text-foreground">{emailSettings?.senderEmail ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Display Name</span>
            <span className="text-foreground">{emailSettings?.senderName ?? "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) setLocation("/dashboard");
  }, [isLoading, user, setLocation]);

  const { data: stats, isLoading: loadingStats } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch("/api/admin/stats"),
    refetchInterval: 15000,
  });
  const { data: users = [], isLoading: loadingUsers } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/api/admin/users"),
    refetchInterval: 30000,
  });
  const { data: monitors = [], isLoading: loadingMonitors } = useQuery<AdminMonitor[]>({
    queryKey: ["admin-monitors"],
    queryFn: () => apiFetch("/api/admin/monitors"),
    refetchInterval: 15000,
  });
  const { data: activity = [], isLoading: loadingActivity } = useQuery<ActivityEntry[]>({
    queryKey: ["admin-activity"],
    queryFn: () => apiFetch("/api/admin/activity"),
    refetchInterval: 10000,
    enabled: tab === "activity",
  });

  const toggleMonitor = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/monitors/${id}/toggle`, { method: "PATCH", headers: { "content-type": "application/json" } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-monitors"] }); queryClient.invalidateQueries({ queryKey: ["admin-stats"] }); },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to toggle monitor." }),
  });

  const deleteMonitor = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/admin/monitors/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-monitors"] }); queryClient.invalidateQueries({ queryKey: ["admin-stats"] }); toast({ title: "Monitor deleted" }); },
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/admin/users/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); queryClient.invalidateQueries({ queryKey: ["admin-stats"] }); toast({ title: "User deleted" }); },
  });

  const toggleAdmin = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/users/${id}/toggle-admin`, { method: "PATCH", headers: { "content-type": "application/json" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  if (isLoading || !user?.isAdmin) return null;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "monitors", label: `Monitors (${monitors.length})`, icon: Server },
    { id: "users", label: `Users (${users.length})`, icon: Users },
    { id: "activity", label: "Activity", icon: RefreshCw },
    { id: "settings", label: "Email Settings", icon: Mail },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="pb-6 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <p className="font-mono text-xs text-primary uppercase tracking-widest">Admin Panel</p>
          </div>
          <h1 className="font-display text-5xl uppercase tracking-wide text-foreground leading-none">
            System Control
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-2">
            Manage all users, monitors, and system activity.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 font-mono text-xs uppercase tracking-widest px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Users", value: stats?.totalUsers ?? "—", icon: Users, color: "text-foreground" },
                { label: "Total Monitors", value: stats?.totalMonitors ?? "—", icon: Server, color: "text-foreground" },
                { label: "Monitors Up", value: stats?.monitorsUp ?? "—", icon: CheckCircle2, color: "text-primary" },
                { label: "Monitors Down", value: stats?.monitorsDown ?? "—", icon: XCircle, color: "text-destructive" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="border border-border bg-card rounded p-5 card-hover">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
                    <Icon className={`w-4 h-4 ${color} opacity-50`} />
                  </div>
                  <div className={`font-display text-5xl leading-none ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="border border-border bg-card rounded p-5 card-hover">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Total Pings</div>
                <div className="font-display text-5xl text-foreground leading-none">{stats?.totalPings?.toLocaleString() ?? "—"}</div>
              </div>
              <div className="border border-border bg-card rounded p-5 card-hover">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Global Uptime</div>
                <div className="font-display text-5xl text-primary leading-none">{stats ? `${stats.globalUptime.toFixed(1)}%` : "—"}</div>
              </div>
              <div className="border border-border bg-card rounded p-5 card-hover">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Unknown Status</div>
                <div className="font-display text-5xl text-muted-foreground leading-none">{stats?.monitorsUnknown ?? "—"}</div>
              </div>
            </div>

            <div>
              <h2 className="font-display text-2xl uppercase tracking-wide text-muted-foreground mb-4">Recent Monitors</h2>
              <div className="border border-border bg-card rounded overflow-hidden">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border">
                      {["Monitor", "User", "Status", "Last Pinged", "Interval"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {monitors.slice(0, 8).map(m => (
                      <tr key={m.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="font-bold text-foreground truncate max-w-[160px]">{m.name}</div>
                          <div className="text-muted-foreground truncate max-w-[160px]">{m.url}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.userName ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border ${
                            m.lastStatus === "up" ? "bg-primary/10 text-primary border-primary/25"
                            : m.lastStatus === "down" ? "bg-destructive/10 text-destructive border-destructive/25"
                            : "bg-muted/20 text-muted-foreground border-border"}`}>
                            {m.lastStatus.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {m.lastPingedAt ? formatDistanceToNow(new Date(m.lastPingedAt), { addSuffix: true }) : "Never"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.intervalMinutes}m</td>
                      </tr>
                    ))}
                    {!loadingStats && monitors.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No monitors yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Monitors tab */}
        {tab === "monitors" && (
          <div>
            <div className="border border-border bg-card rounded overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border">
                    {["Monitor / URL", "Owner", "Status", "Response", "Last Ping", "Interval", "Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {monitors.map(m => (
                    <tr key={m.id} className="hover:bg-white/[0.02] group">
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground">{m.name}</div>
                        <a href={m.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors truncate block max-w-[200px]">{m.url}</a>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.userName ?? <span className="opacity-40">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`status-dot ${m.lastStatus}`} />
                          <span className={m.lastStatus === "up" ? "text-primary" : m.lastStatus === "down" ? "text-destructive" : "text-muted-foreground"}>
                            {m.lastStatus.toUpperCase()}
                          </span>
                          {!m.active && <span className="text-[10px] text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-1 rounded">PAUSED</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.lastResponseTimeMs ? <span className="text-primary">{m.lastResponseTimeMs}ms</span> : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.lastPingedAt ? formatDistanceToNow(new Date(m.lastPingedAt), { addSuffix: true }) : "Never"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.intervalMinutes}m</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-primary" onClick={() => toggleMonitor.mutate(m.id)}>
                            {m.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => { if (confirm(`Delete "${m.name}"?`)) deleteMonitor.mutate(m.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loadingMonitors && monitors.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No monitors</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users tab */}
        {tab === "users" && (
          <div>
            <div className="border border-border bg-card rounded overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border">
                    {["User", "Email", "Role", "Monitors", "Notifications", "Joined", "Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-white/[0.02] group">
                      <td className="px-4 py-3 font-bold text-foreground">{u.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        {u.isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-primary/10 text-primary border border-primary/25">
                            <ShieldCheck className="w-3 h-3" /> ADMIN
                          </span>
                        ) : (
                          <span className="text-muted-foreground">User</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground font-bold">{u.monitorCount}</td>
                      <td className="px-4 py-3">
                        <span className={u.notificationsEnabled ? "text-primary" : "text-muted-foreground"}>
                          {u.notificationsEnabled ? "ON" : "OFF"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(u.createdAt), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-[10px] hover:text-primary" onClick={() => toggleAdmin.mutate(u.id)}
                            title={u.isAdmin ? "Remove admin" : "Make admin"}>
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => { if (confirm(`Delete user "${u.name}"? This will also delete all their monitors.`)) deleteUser.mutate(u.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loadingUsers && users.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No users</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Activity tab */}
        {tab === "activity" && (
          <div>
            <div className="border border-border bg-card rounded overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-display text-xl uppercase tracking-wide text-muted-foreground">Live Ping Log</h3>
                <span className="font-mono text-xs text-muted-foreground">Last 100 pings</span>
              </div>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border">
                    {["Timestamp", "Monitor", "User", "Status", "Response", "Code", "Error"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activity.map(a => (
                    <tr key={a.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(new Date(a.createdAt), "MMM d, HH:mm:ss")}</td>
                      <td className="px-4 py-3">
                        <div className="text-foreground font-bold truncate max-w-[140px]">{a.monitorName ?? "—"}</div>
                        <div className="text-muted-foreground truncate max-w-[140px]">{a.monitorUrl ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.userName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border ${a.status === "up" ? "bg-primary/10 text-primary border-primary/25" : "bg-destructive/10 text-destructive border-destructive/25"}`}>
                          {a.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{a.responseTimeMs ? <span className="text-primary">{a.responseTimeMs}ms</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.statusCode ?? "—"}</td>
                      <td className="px-4 py-3 text-destructive truncate max-w-[160px]">{a.error ?? "—"}</td>
                    </tr>
                  ))}
                  {!loadingActivity && activity.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No ping activity yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings tab */}
        {tab === "settings" && <EmailSettingsTab />}
      </div>
    </Layout>
  );
}
