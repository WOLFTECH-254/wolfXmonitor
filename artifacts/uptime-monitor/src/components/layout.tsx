import { Link, useLocation } from "wouter";
import { Radio, Plus, Zap, LogOut, User, ShieldCheck, AlertTriangle, Crown, LayoutDashboard, Globe, ChevronDown, ChevronRight, Activity, Server, Users, CreditCard, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const isOnAdmin = location.startsWith("/admin");
  const [adminOpen, setAdminOpen] = useState(isOnAdmin);

  useEffect(() => {
    if (isOnAdmin) setAdminOpen(true);
  }, [isOnAdmin]);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const ADMIN_TABS = [
    { id: "overview",  label: "Overview",  Icon: Activity },
    { id: "monitors",  label: "Monitors",  Icon: Server },
    { id: "users",     label: "Users",     Icon: Users },
    { id: "activity",  label: "Activity",  Icon: Radio },
    { id: "payments",  label: "Payments",  Icon: CreditCard },
    { id: "settings",  label: "Settings",  Icon: Settings },
  ] as const;

  const currentTab = isOnAdmin
    ? new URLSearchParams(window.location.search).get("tab") ?? "overview"
    : "";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row dark">
      {/* Sidebar */}
      <aside className="w-full md:w-56 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-5 border-b border-border">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center group-hover:border-primary/70 transition-colors shrink-0">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display text-xl tracking-wide text-foreground">
              wolf<span className="text-primary">X</span>monitor
            </span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1 pt-4">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest px-3 pb-2">Navigation</p>
          <Link href="/dashboard">
            <Button
              variant={location === "/dashboard" ? "secondary" : "ghost"}
              className="w-full justify-start gap-3 font-mono text-sm h-9 rounded"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/monitoring">
            <Button
              variant={location === "/monitoring" || location.startsWith("/monitors/") ? "secondary" : "ghost"}
              className="w-full justify-start gap-3 font-mono text-sm h-9 rounded"
            >
              <Radio className="w-4 h-4" />
              Monitoring
            </Button>
          </Link>
          <Link href="/monitors/new">
            <Button
              variant={location === "/monitors/new" ? "secondary" : "ghost"}
              className="w-full justify-start gap-3 font-mono text-sm h-9 rounded"
            >
              <Plus className="w-4 h-4" />
              New Monitor
            </Button>
          </Link>
          <Link href="/incidents">
            <Button
              variant={location === "/incidents" ? "secondary" : "ghost"}
              className="w-full justify-start gap-3 font-mono text-sm h-9 rounded"
            >
              <AlertTriangle className="w-4 h-4" />
              Incidents
            </Button>
          </Link>
          <Link href="/status">
            <Button
              variant={location.startsWith("/status") ? "secondary" : "ghost"}
              className="w-full justify-start gap-3 font-mono text-sm h-9 rounded"
            >
              <Globe className="w-4 h-4" />
              Status Page
            </Button>
          </Link>

          {user?.plan !== "pro" && (
            <Link href="/upgrade">
              <Button
                variant={location === "/upgrade" ? "secondary" : "ghost"}
                className="w-full justify-start gap-3 font-mono text-sm h-9 rounded text-primary hover:text-primary"
              >
                <Crown className="w-4 h-4" />
                Upgrade to Pro
              </Button>
            </Link>
          )}

          {user?.isAdmin && (
            <div className="pt-4">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest px-3 pb-2">Admin</p>

              {/* Expandable Control Panel */}
              <button
                onClick={() => setAdminOpen((o) => !o)}
                className={`w-full flex items-center justify-between gap-3 font-mono text-sm h-9 rounded px-3 transition-colors ${isOnAdmin ? "bg-secondary text-secondary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground"}`}
              >
                <span className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  Control Panel
                </span>
                {adminOpen
                  ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                }
              </button>

              {adminOpen && (
                <div className="mt-1 ml-3 pl-3 border-l border-border space-y-0.5">
                  {ADMIN_TABS.map(({ id, label, Icon }) => (
                    <Link key={id} href={`/admin?tab=${id}`}>
                      <Button
                        variant={isOnAdmin && currentTab === id ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2.5 font-mono text-xs h-8 rounded"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </Button>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-border space-y-3">
          {user && (
            <div className="flex items-start gap-2 px-1">
              <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                {user.isAdmin ? <ShieldCheck className="w-3 h-3 text-primary" /> : <User className="w-3 h-3 text-primary" />}
              </div>
              <div className="min-w-0">
                <div className="font-mono text-xs text-foreground truncate">{user.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground truncate">{user.isAdmin ? "Admin" : user.email}</div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="status-dot up" />
              <span className="font-mono text-xs text-muted-foreground">Online</span>
            </div>
            <button
              onClick={handleLogout}
              className="font-mono text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto grid-bg">
        <div className="max-w-6xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
