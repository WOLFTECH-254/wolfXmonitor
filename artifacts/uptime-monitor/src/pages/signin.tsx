import { BrandMark } from "@/components/brand-mark";
import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Eye, EyeOff, Activity, Shield, Bell } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function SignIn() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setLocation("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark overflow-hidden">
      <Helmet>
        <title>Sign In — GuardiX</title>
        <meta name="description" content="Sign in to your GuardiX account and keep an eye on your uptime." />
        <meta property="og:title" content="Sign In — GuardiX" />
      </Helmet>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 border-b border-border bg-background">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
            <BrandMark className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-xl tracking-wide">Guardi<span className="text-primary">X</span></span>
        </Link>
        <Link href="/signup">
          <button className="font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-5 py-2 rounded font-bold tracking-wide">
            Create Account
          </button>
        </Link>
      </nav>

      <div className="flex min-h-screen pt-16">
        {/* Left — brand panel */}
        <div className="hidden lg:flex flex-col justify-center px-16 w-[52%] relative border-r border-border">
          <div className="relative z-10 max-w-lg">
            <div className="inline-flex items-center gap-2 border border-border rounded-full px-3 py-1 mb-10">
              <span className="status-dot up" />
              <span className="font-mono text-xs text-muted-foreground tracking-wide">All systems operational</span>
            </div>
            <h1 className="font-display leading-[1.05] mb-6">
              <span className="block text-[clamp(44px,5.5vw,84px)] text-foreground">Welcome</span>
              <span className="block text-[clamp(44px,5.5vw,84px)] text-primary">back.</span>
            </h1>
            <p className="font-mono text-muted-foreground text-sm leading-relaxed mb-12 max-w-sm">
              GuardiX watches your endpoints. Every minute. Every day. Never sleeping.
            </p>
            <div className="space-y-4">
              {[
                { icon: Activity, text: "Real-time response time tracking" },
                { icon: Bell, text: "Instant email alerts via Brevo" },
                { icon: Shield, text: "Auto-ping keeps Render apps awake" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 border border-primary/25 rounded flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — form panel */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-10">
              <p className="font-mono text-xs text-primary uppercase tracking-widest mb-3">Access your account</p>
              <h2 className="font-display text-5xl uppercase tracking-wide text-foreground leading-none">
                Sign In
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="border border-destructive/40 bg-destructive/10 rounded px-4 py-3 font-mono text-xs text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-card border border-border rounded px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-card border border-border rounded px-4 py-3 pr-11 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all py-3.5 rounded font-bold tracking-wider group mt-2"
              >
                {loading ? "Signing in..." : "Sign In"}
                {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-border text-center">
              <p className="font-mono text-xs text-muted-foreground">
                No account yet?{" "}
                <Link href="/signup" className="text-primary hover:underline">Create one free →</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
