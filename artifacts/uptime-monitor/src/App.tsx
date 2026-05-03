import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import MonitorNew from "@/pages/monitor-new";
import MonitorDetail from "@/pages/monitor-detail";
import SignIn from "@/pages/signin";
import SignUp from "@/pages/signup";
import Admin from "@/pages/admin";
import StatusPage from "@/pages/status";
import InstancePage from "@/pages/instance";
import Upgrade from "@/pages/upgrade";
import Incidents from "@/pages/incidents";
import Monitoring from "@/pages/monitoring";
import Settings from "@/pages/settings";
import Docs from "@/pages/docs";
import Profile from "@/pages/profile";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/signin");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="font-mono text-xs text-muted-foreground tracking-widest animate-pulse uppercase">
          Authenticating...
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/signin" component={SignIn} />
      <Route path="/signup" component={SignUp} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/monitoring">
        {() => <ProtectedRoute component={Monitoring} />}
      </Route>
      <Route path="/monitors/new">
        {() => <ProtectedRoute component={MonitorNew} />}
      </Route>
      <Route path="/monitors/:id">
        {() => <ProtectedRoute component={MonitorDetail} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={Admin} />}
      </Route>
      <Route path="/upgrade">
        {() => <ProtectedRoute component={Upgrade} />}
      </Route>
      <Route path="/status" component={StatusPage} />
      <Route path="/status/:id" component={InstancePage} />
      <Route path="/incidents">
        {() => <ProtectedRoute component={Incidents} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/docs" component={Docs} />
      <Route path="/profile">
        {() => <ProtectedRoute component={Profile} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
