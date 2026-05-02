import { Link, useLocation } from "wouter";
import { Activity, Plus, TerminalSquare } from "lucide-react";
import { Button } from "./ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row dark">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card/50 flex flex-col">
        <div className="p-6 border-b border-border">
          <Link href="/" className="flex items-center gap-3 font-mono font-bold text-lg text-primary hover:opacity-80 transition-opacity">
            <TerminalSquare className="w-6 h-6" />
            <span>PingWatch</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/">
            <Button
              variant={location === "/" ? "secondary" : "ghost"}
              className="w-full justify-start gap-3 font-mono text-sm"
            >
              <Activity className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/monitors/new">
            <Button
              variant={location === "/monitors/new" ? "secondary" : "ghost"}
              className="w-full justify-start gap-3 font-mono text-sm"
            >
              <Plus className="w-4 h-4" />
              New Monitor
            </Button>
          </Link>
        </nav>
        <div className="p-4 border-t border-border mt-auto">
          <div className="text-xs font-mono text-muted-foreground text-center">
            System Online • v1.0.0
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
