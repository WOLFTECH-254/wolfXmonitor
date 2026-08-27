import { BrandMark } from "@/components/brand-mark";
import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Eye, EyeOff, Globe, Clock, BarChart2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SocialAuthButtons } from "@/components/social-auth-buttons";

const COUNTRIES = [
  { code: "NG", name: "Nigeria" }, { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" }, { code: "ZA", name: "South Africa" },
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" }, { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" }, { code: "FR", name: "France" },
  { code: "IN", name: "India" }, { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" }, { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" }, { code: "AE", name: "UAE" },
  { code: "RW", name: "Rwanda" }, { code: "TZ", name: "Tanzania" },
  { code: "UG", name: "Uganda" }, { code: "ET", name: "Ethiopia" },
  { code: "EG", name: "Egypt" }, { code: "MA", name: "Morocco" },
  { code: "NG", name: "Nigeria" }, { code: "SN", name: "Senegal" },
  { code: "OTHER", name: "Other" },
];

export default function SignUp() {
  const [, setLocation] = useLocation();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await register(name, email, password, country || undefined);
      setLocation("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark overflow-hidden">
      <Helmet>
        <title>Get Started Free — GuardiX</title>
        <meta name="description" content="Create your free GuardiX account. Monitor up to 5 sites with instant downtime alerts." />
        <meta property="og:title" content="Get Started Free — GuardiX" />
      </Helmet>
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 border-b border-border bg-background">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
            <BrandMark className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-xl tracking-wide">Guardi<span className="text-primary">X</span></span>
        </Link>
        <Link href="/signin">
          <button className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2">
            Already have an account? Sign in →
          </button>
        </Link>
      </nav>

      <div className="flex min-h-screen pt-16">
        {/* Left — brand panel */}
        <div className="hidden lg:flex flex-col justify-center px-16 w-[52%] relative border-r border-border">
          <div className="relative z-10 max-w-lg">
            <h1 className="font-display leading-[1.05] mb-6">
              <span className="block text-[clamp(40px,5vw,76px)] text-foreground">Start</span>
              <span className="block text-[clamp(40px,5vw,76px)] text-foreground">watching</span>
              <span className="block text-[clamp(40px,5vw,76px)] text-primary">now.</span>
            </h1>
            <p className="font-mono text-muted-foreground text-sm leading-relaxed mb-12 max-w-sm">
              Free forever. Add your Render, Railway, or Fly.io endpoints and keep them alive around the clock.
            </p>
            <div className="grid grid-cols-3 border border-border bg-card rounded-lg overflow-hidden">
              {[
                { value: "99.9%", label: "Uptime SLA" },
                { value: "<30s", label: "Detection" },
                { value: "Free", label: "To start" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center py-5 border-r border-border last:border-r-0">
                  <div className="font-display text-3xl text-foreground leading-none">{s.value}</div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1.5 uppercase tracking-widest">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-10 space-y-4">
              {[
                { icon: Globe, text: "Add any HTTP/HTTPS endpoint" },
                { icon: Clock, text: "Ping on your schedule (1–60 min)" },
                { icon: BarChart2, text: "Response time & uptime history" },
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

        {/* Right — form */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-10">
              <p className="font-mono text-xs text-primary uppercase tracking-widest mb-3">Free account</p>
              <h2 className="font-display text-5xl uppercase tracking-wide text-foreground leading-none">
                Create Account
              </h2>
            </div>

            {error && (
              <div className="border border-destructive/40 bg-destructive/10 rounded px-4 py-3 font-mono text-xs text-destructive mb-5">
                {error}
              </div>
            )}

            <SocialAuthButtons />

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Name</label>
                <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Your name" required
                  className="w-full bg-card border border-border rounded px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors" />
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Email</label>
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                  className="w-full bg-card border border-border rounded px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors" />
                <p className="font-mono text-[10px] text-muted-foreground">Down alerts will be sent here.</p>
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Country</label>
                <select value={country} onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-card border border-border rounded px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors appearance-none">
                  <option value="">Select your country</option>
                  {COUNTRIES.filter((c, i, arr) => arr.findIndex(x => x.code === c.code) === i).map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <p className="font-mono text-[10px] text-muted-foreground">Used to show pricing in your currency.</p>
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Password</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} autoComplete="new-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters" required
                    className="w-full bg-card border border-border rounded px-4 py-3 pr-11 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all py-3.5 rounded font-bold tracking-wider group mt-2">
                {loading ? "Creating account..." : "Create Account"}
                {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-border text-center">
              <p className="font-mono text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link href="/signin" className="text-primary hover:underline">Sign in →</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
