import { BrandMark } from "@/components/brand-mark";
import { Link, useLocation } from "wouter";
import {
  Radio, LogOut, User, ShieldCheck, AlertTriangle, Crown, LayoutDashboard,
  Globe, ChevronDown, ChevronRight, Activity, Server, Users, CreditCard,
  Settings, Menu, X, BellRing, BookOpen, UserCircle, Code2,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";

type NavEntry = { href: string; icon: LucideIcon; label: string; match?: (path: string) => boolean };

const MAIN_NAV: NavEntry[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/monitoring", icon: Radio, label: "Monitors", match: (p) => p === "/monitoring" || p.startsWith("/monitors/") },
  { href: "/incidents", icon: AlertTriangle, label: "Incidents" },
  { href: "/settings", icon: BellRing, label: "Integrations & API" },
];

const RESOURCE_NAV: NavEntry[] = [
  { href: "/status", icon: Globe, label: "Status Page", match: (p) => p.startsWith("/status") },
  { href: "/docs", icon: BookOpen, label: "Documentation" },
  { href: "/profile", icon: UserCircle, label: "My Profile" },
  { href: "/developer", icon: Code2, label: "Developer" },
];

const ADMIN_TABS = [
  { id: "overview", label: "Overview", Icon: Activity },
  { id: "monitors", label: "Monitors", Icon: Server },
  { id: "users", label: "Users", Icon: Users },
  { id: "activity", label: "Activity", Icon: Radio },
  { id: "payments", label: "Payments", Icon: CreditCard },
  { id: "settings", label: "Settings", Icon: Settings },
  { id: "developer", label: "Developer", Icon: Code2 },
] as const;

function NavLink({ entry, active }: { entry: NavEntry; active: boolean }) {
  const { icon: Icon, href, label } = entry;
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 h-10 px-3 rounded-lg text-sm transition-colors ${
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
      }`}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />}
      <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.15em] px-3 pt-6 pb-2 first:pt-0">
      {children}
    </p>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const isOnAdmin = location.startsWith("/admin");
  const [adminOpen, setAdminOpen] = useState(isOnAdmin);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isOnAdmin) setAdminOpen(true);
  }, [isOnAdmin]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const currentTab = isOnAdmin
    ? new URLSearchParams(window.location.search).get("tab") ?? "overview"
    : "";

  const isActive = (e: NavEntry) => (e.match ? e.match(location) : location === e.href);

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="h-16 px-5 border-b border-border flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:border-primary/60 transition-colors shrink-0">
            <BrandMark className="w-[18px] h-[18px] text-primary" />
          </div>
          <span className="font-display text-xl text-foreground">
            Guardi<span className="text-primary">X</span>
          </span>
        </Link>
        <button
          className="md:hidden text-muted-foreground hover:text-foreground transition-colors -mr-1 p-1"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-5 pb-4 overflow-y-auto">
        <SectionLabel>Menu</SectionLabel>
        <div className="space-y-1">
          {MAIN_NAV.map((e) => (
            <NavLink key={e.href} entry={e} active={isActive(e)} />
          ))}
        </div>

        <SectionLabel>Resources</SectionLabel>
        <div className="space-y-1">
          {RESOURCE_NAV.map((e) => (
            <NavLink key={e.href} entry={e} active={isActive(e)} />
          ))}
        </div>

        {user?.isAdmin && (
          <>
            <SectionLabel>Admin</SectionLabel>
            <button
              onClick={() => setAdminOpen((o) => !o)}
              className={`w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm transition-colors ${
                isOnAdmin
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              <ShieldCheck className={`w-[18px] h-[18px] shrink-0 ${isOnAdmin ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left">Control Panel</span>
              {adminOpen ? <ChevronDown className="w-4 h-4 opacity-60" /> : <ChevronRight className="w-4 h-4 opacity-60" />}
            </button>

            {adminOpen && (
              <div className="mt-1 ml-4 pl-3 border-l border-border space-y-0.5">
                {ADMIN_TABS.map(({ id, label, Icon }) => {
                  const active = isOnAdmin && currentTab === id;
                  return (
                    <Link
                      key={id}
                      href={`/admin?tab=${id}`}
                      className={`flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13px] transition-colors ${
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {user?.plan !== "pro" && (
          <Link
            href="/upgrade"
            className="mt-6 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] p-3.5 hover:border-primary/45 hover:bg-primary/10 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Crown className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Upgrade to Pro</div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-snug">Unlimited monitors &amp; faster checks</div>
            </div>
          </Link>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3 shrink-0">
        {user && (
          <div className="flex items-center gap-3 p-2 rounded-lg">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
              {user.isAdmin ? <ShieldCheck className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-primary" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-foreground truncate font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground truncate">{user.isAdmin ? "Administrator" : user.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10 shrink-0"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 px-2 pt-2">
          <span className="status-dot up" />
          <span className="font-mono text-[11px] text-muted-foreground">All systems online</span>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col dark">
      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-card shrink-0">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <BrandMark className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-lg text-foreground">
            Guardi<span className="text-primary">X</span>
          </span>
        </Link>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors p-1.5 -mr-1.5"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col shrink-0">
          <SidebarContent />
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <aside className="relative w-[284px] max-w-[85vw] bg-card border-r border-border flex flex-col h-full">
              <SidebarContent />
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto grid-bg">
          <div className="max-w-6xl mx-auto p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
