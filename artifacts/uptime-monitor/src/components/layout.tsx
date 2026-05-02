import { Link, useLocation } from "wouter";
import { Activity, Plus, Zap, LogOut, User, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

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
              <Activity className="w-4 h-4" />
              Dashboard
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

          {user?.isAdmin && (
            <>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest px-3 pb-2 pt-4">Admin</p>
              <Link href="/admin">
                <Button
                  variant={location === "/admin" ? "secondary" : "ghost"}
                  className="w-full justify-start gap-3 font-mono text-sm h-9 rounded"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Control Panel
                </Button>
              </Link>
            </>
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
