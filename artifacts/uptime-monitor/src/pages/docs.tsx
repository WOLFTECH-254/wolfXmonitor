import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { Zap, ExternalLink, ChevronRight, Menu, X } from "lucide-react";

const sections = [
  { id: "overview",      label: "Overview" },
  { id: "getting-started", label: "Getting Started" },
  { id: "monitors",     label: "Monitors" },
  { id: "alerts",       label: "Alerts" },
  { id: "telegram",     label: "— Telegram" },
  { id: "whatsapp",     label: "— WhatsApp" },
  { id: "discord",      label: "— Discord" },
  { id: "plans",        label: "Plans & Billing" },
  { id: "status-page",  label: "Status Page" },
  { id: "admin",        label: "Admin Panel" },
  { id: "api",          label: "API Reference" },
  { id: "faq",          label: "FAQ" },
];

function useActiveSection() {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const handler = () => {
      for (let i = els.length - 1; i >= 0; i--) {
        if (els[i].getBoundingClientRect().top <= 120) {
          setActive(els[i].id);
          return;
        }
      }
      setActive("overview");
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return active;
}

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="font-display text-2xl tracking-wide text-foreground mt-14 mb-4 scroll-mt-24 flex items-center gap-3"
    >
      <span className="text-primary">#</span> {children}
    </h2>
  );
}

function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="font-display text-lg tracking-wide text-foreground mt-8 mb-3 scroll-mt-24"
    >
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-4">{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted/40 border border-border rounded px-1.5 py-0.5 font-mono text-xs text-primary">
      {children}
    </code>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-card border border-border rounded-lg p-4 font-mono text-xs text-muted-foreground overflow-x-auto mb-6 leading-relaxed">
      {children}
    </pre>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full font-mono text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h) => (
              <th key={h} className="text-left text-muted-foreground uppercase tracking-widest py-2 pr-6">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40">
              {row.map((cell, j) => (
                <td key={j} className="py-2.5 pr-6 text-foreground/80 leading-relaxed">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6 flex gap-3">
      <span className="text-primary font-mono text-xs shrink-0 mt-0.5">ℹ</span>
      <div className="font-mono text-xs text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

export default function Docs() {
  const active = useActiveSection();
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <Helmet>
        <title>Documentation — wolfXmonitor</title>
        <meta name="description" content="Complete documentation for wolfXmonitor — setup, monitoring, alerts, API reference, and more." />
      </Helmet>

      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-display text-lg tracking-wide">
              wolf<span className="text-primary">X</span>monitor
            </span>
            <span className="hidden sm:block font-mono text-xs text-muted-foreground ml-1">/ docs</span>
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="https://monitor.xwolf.space"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Open App <ExternalLink className="w-3 h-3" />
            </a>
            <button
              className="md:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setMobileNav(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 flex gap-12 py-10">
        {/* Sidebar nav — desktop */}
        <nav className="hidden md:block w-48 shrink-0 sticky top-24 self-start">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Contents</p>
          <ul className="space-y-0.5">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => scrollTo(s.id)}
                  className={`w-full text-left font-mono text-xs py-1.5 px-2 rounded transition-colors ${
                    active === s.id
                      ? "text-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  } ${s.label.startsWith("—") ? "pl-4" : ""}`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile nav overlay */}
        {mobileNav && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} />
            <nav className="relative w-64 bg-card border-r border-border h-full p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Contents</span>
                <button onClick={() => setMobileNav(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <ul className="space-y-0.5">
                {sections.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => { scrollTo(s.id); setMobileNav(false); }}
                      className={`w-full text-left font-mono text-xs py-1.5 px-2 rounded transition-colors ${
                        active === s.id ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
                      } ${s.label.startsWith("—") ? "pl-4" : ""}`}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        )}

        {/* Main content */}
        <article className="flex-1 min-w-0 max-w-3xl">

          {/* Overview */}
          <H2 id="overview">Overview</H2>
          <P>
            wolfXmonitor is a full-stack SaaS uptime monitoring platform. It pings your websites and APIs
            every minute and alerts you instantly — by email, Telegram, WhatsApp, and Discord — the moment
            they go down. It supports multiple users, Free and Pro subscription tiers, a public status page,
            and a full admin control panel.
          </P>
          <P>
            Live at <Code>monitor.xwolf.space</Code>. Built with React 19, Node.js 22, PostgreSQL 17, and
            deployed on a VPS behind Nginx + PM2.
          </P>
          <Note>
            This documentation covers everything — from adding your first monitor to configuring chat alerts
            and the admin panel. If something is unclear, open an issue on GitHub.
          </Note>

          {/* Getting Started */}
          <H2 id="getting-started">Getting Started</H2>
          <H3>1. Create an account</H3>
          <P>
            Visit <Code>monitor.xwolf.space/signup</Code> and register. The very first account created on
            the platform automatically becomes the admin account.
          </P>
          <H3>2. Add your first monitor</H3>
          <P>
            Go to <Code>New Monitor</Code> in the sidebar. Enter a name and the URL you want to watch
            (e.g. <Code>https://yourdomain.com</Code>). wolfXmonitor will ping it every minute from the
            moment you save it.
          </P>
          <H3>3. Set up alerts</H3>
          <P>
            Email alerts are on by default — they go to the address you registered with. To add Telegram,
            WhatsApp, or Discord alerts, go to <Code>Integrations &amp; API</Code> in the sidebar.
          </P>

          {/* Monitors */}
          <H2 id="monitors">Monitors</H2>
          <P>
            Each monitor is a URL that wolfXmonitor checks on a fixed interval. When a check fails
            (connection refused, timeout, non-2xx status code), an incident is opened and all enabled alert
            channels fire. When the URL comes back up, a recovery alert is sent.
          </P>
          <Table
            headers={["Field", "Description"]}
            rows={[
              ["Name", "Friendly label for the monitor — shown in alerts and the dashboard"],
              ["URL", "The full URL to ping, including https://"],
              ["Interval", "How often to check — default 1 minute"],
              ["Status", "Live badge showing up / down / unknown"],
              ["Uptime %", "Rolling 30-day uptime percentage"],
              ["Response time", "Average latency recorded per ping"],
            ]}
          />
          <P>
            Free plan users can monitor up to the limit set by the admin (shown on the Upgrade page).
            Pro users have no monitor limit.
          </P>

          {/* Alerts */}
          <H2 id="alerts">Alerts</H2>
          <P>
            Alerts are deduplicated — you receive one notification when a site goes down and one when it
            recovers, regardless of how many pings fail in between. All enabled channels fire simultaneously.
          </P>

          <H3 id="telegram">Telegram</H3>
          <P>
            wolfXmonitor sends alerts via the official Telegram Bot API. Messages are formatted with HTML
            and arrive instantly in your Telegram chat.
          </P>
          <P><strong className="text-foreground">Setup:</strong></P>
          <ol className="font-mono text-sm text-muted-foreground leading-relaxed mb-6 space-y-2 list-decimal list-inside">
            <li>Open Telegram and message <Code>@userinfobot</Code> — send <Code>/start</Code> to get your numeric Chat ID.</li>
            <li>Also message <Code>@wolfXmonitor_bot</Code> and send <Code>/start</Code> to activate the bot for your chat.</li>
            <li>Go to <Code>Integrations &amp; API</Code> in wolfXmonitor, paste your Chat ID, click Save.</li>
            <li>Click <Code>Send test message</Code> to verify — a test alert will appear in your Telegram.</li>
          </ol>

          <H3 id="whatsapp">WhatsApp</H3>
          <P>
            WhatsApp alerts are sent via the Twilio WhatsApp API. The admin must configure Twilio credentials
            in the Admin Panel before this channel is available.
          </P>
          <P><strong className="text-foreground">Setup:</strong></P>
          <ol className="font-mono text-sm text-muted-foreground leading-relaxed mb-6 space-y-2 list-decimal list-inside">
            <li>Go to <Code>Integrations &amp; API</Code> in wolfXmonitor.</li>
            <li>Enter your phone number in international format, e.g. <Code>+254712345678</Code>.</li>
            <li>Click Save, then Send test message.</li>
          </ol>
          <Note>
            WhatsApp alerts require Twilio credentials to be configured by the platform admin. If the test
            fails with a credentials error, contact your admin.
          </Note>

          <H3 id="discord">Discord</H3>
          <P>
            Discord alerts arrive as rich color-coded embeds in any channel you choose — no bot invite
            needed, just a webhook URL. Red embed for down, green for recovery.
          </P>
          <P><strong className="text-foreground">Setup:</strong></P>
          <ol className="font-mono text-sm text-muted-foreground leading-relaxed mb-6 space-y-2 list-decimal list-inside">
            <li>Open Discord and go to the server &amp; channel where you want alerts.</li>
            <li>Click <strong className="text-foreground">Edit Channel → Integrations → Webhooks → New Webhook</strong>.</li>
            <li>Name it <Code>wolfXmonitor</Code> and click <strong className="text-foreground">Copy Webhook URL</strong>.</li>
            <li>Paste the URL in <Code>Integrations &amp; API</Code> → Discord card, click Save.</li>
            <li>Click <Code>Send test message</Code> — a green test embed should appear in your channel.</li>
          </ol>

          {/* Plans */}
          <H2 id="plans">Plans & Billing</H2>
          <Table
            headers={["Feature", "Free", "Pro"]}
            rows={[
              ["Monitors", "Up to admin limit", "Unlimited"],
              ["1-min ping intervals", "✓", "✓"],
              ["Email alerts", "✓", "✓"],
              ["Telegram alerts", "✓", "✓"],
              ["WhatsApp alerts", "✓", "✓"],
              ["Discord alerts", "✓", "✓"],
              ["Public status page", "✓", "✓"],
              ["Incident history", "✓", "✓"],
              ["Price", "Free forever", "Set by admin (KES)"],
            ]}
          />
          <P>
            Payments are processed via Paystack. Kenyan users see an M-Pesa / Card picker automatically.
            After a successful payment, your plan activates instantly via webhook verification — no manual
            approval needed.
          </P>
          <P>
            To upgrade, go to <Code>Upgrade to Pro</Code> in the sidebar and follow the checkout flow.
          </P>

          {/* Status Page */}
          <H2 id="status-page">Status Page</H2>
          <P>
            Every account gets a public status page at <Code>monitor.xwolf.space/status</Code> showing
            live green/red health for all your monitors. You can share this URL with your users or customers
            so they can check service health without logging in.
          </P>
          <P>
            Individual monitor status pages are available at <Code>/status/:id</Code>, showing uptime
            history, response time trends, and recent incidents for that specific monitor.
          </P>

          {/* Admin */}
          <H2 id="admin">Admin Panel</H2>
          <P>
            The first registered user is automatically the admin. The admin panel is accessible at
            <Code>/admin</Code> and contains six tabs:
          </P>
          <Table
            headers={["Tab", "What you can do"]}
            rows={[
              ["Overview", "Platform-wide stats — total users, monitors, and uptime summary"],
              ["Monitors", "See and manage every monitor across all users"],
              ["Users", "View all accounts, change plans, delete users"],
              ["Activity", "Security event log — failed logins, brute force attempts"],
              ["Payments", "Set Paystack public & secret keys, billing currency, Pro plan price"],
              ["Settings", "Brevo email config, Chat Notifications (Telegram bot token + Twilio), free plan limit, footer links"],
            ]}
          />
          <H3>Setting up email alerts (Brevo)</H3>
          <ol className="font-mono text-sm text-muted-foreground leading-relaxed mb-6 space-y-2 list-decimal list-inside">
            <li>Sign up at <Code>brevo.com</Code> and get a free API key (300 emails/day free).</li>
            <li>Go to <Code>Admin → Settings → Email Notifications</Code>.</li>
            <li>Enter the API key, sender name, and a verified sender email address.</li>
            <li>Save — email alerts are live immediately.</li>
          </ol>
          <H3>Setting up Telegram (admin side)</H3>
          <ol className="font-mono text-sm text-muted-foreground leading-relaxed mb-6 space-y-2 list-decimal list-inside">
            <li>Message <Code>@BotFather</Code> on Telegram → <Code>/newbot</Code> → follow prompts → copy the token.</li>
            <li>Go to <Code>Admin → Settings → Chat Notifications → Telegram Bot Token</Code>.</li>
            <li>Paste and save — users can now connect their Chat IDs.</li>
          </ol>

          {/* API */}
          <H2 id="api">API Reference</H2>
          <P>
            All endpoints are prefixed with <Code>/api</Code>. Session authentication is required for
            protected routes — log in via <Code>POST /api/auth/login</Code> first.
          </P>
          <H3>Authentication</H3>
          <Table
            headers={["Method", "Endpoint", "Description"]}
            rows={[
              ["POST", "/api/auth/register", "Register a new account"],
              ["POST", "/api/auth/login", "Log in — returns session cookie"],
              ["POST", "/api/auth/logout", "Destroy session"],
              ["GET",  "/api/auth/me", "Get current logged-in user"],
            ]}
          />
          <H3>Monitors</H3>
          <Table
            headers={["Method", "Endpoint", "Description"]}
            rows={[
              ["GET",    "/api/monitors",        "List all monitors for the current user"],
              ["POST",   "/api/monitors",        "Create a new monitor"],
              ["GET",    "/api/monitors/:id",    "Get a single monitor with ping history"],
              ["DELETE", "/api/monitors/:id",    "Delete a monitor"],
              ["POST",   "/api/monitors/:id/ping", "Manually trigger a ping"],
            ]}
          />
          <H3>Notification Channels</H3>
          <Table
            headers={["Method", "Endpoint", "Description"]}
            rows={[
              ["GET",  "/api/me/channels",      "Get saved Telegram, WhatsApp, Discord settings"],
              ["PUT",  "/api/me/channels",      "Save channel settings"],
              ["POST", "/api/me/channels/test", "Send a test message to telegram / whatsapp / discord"],
            ]}
          />
          <H3>Dashboard & Public</H3>
          <Table
            headers={["Method", "Endpoint", "Description"]}
            rows={[
              ["GET", "/api/dashboard/summary",  "Uptime stats for the current user"],
              ["GET", "/api/status",             "Public status page data (all monitors, all users)"],
              ["GET", "/api/status/:id",         "Public status for a single monitor"],
              ["GET", "/api/stats/countries",    "User country distribution (public)"],
              ["GET", "/api/payments/config",    "Paystack config + detected user country"],
              ["POST","/api/payments/verify",    "Verify Paystack payment, activate Pro"],
            ]}
          />
          <H3>Example — create a monitor</H3>
          <Pre>{`curl -X POST https://monitor.xwolf.space/api/monitors \\
  -H "Content-Type: application/json" \\
  --cookie "your-session-cookie" \\
  -d '{"name": "My Site", "url": "https://example.com", "intervalMinutes": 1}'`}</Pre>

          {/* FAQ */}
          <H2 id="faq">FAQ</H2>

          <H3>How do I get my Telegram Chat ID?</H3>
          <P>
            Open Telegram, search for <Code>@userinfobot</Code>, and send <Code>/start</Code>. It replies
            with your numeric Chat ID. Then message <Code>@wolfXmonitor_bot</Code> and send <Code>/start</Code>
            so the bot can reach you.
          </P>

          <H3>Why am I not receiving email alerts?</H3>
          <P>
            Check that the admin has configured a valid Brevo API key and verified sender email under
            Admin → Settings → Email. Also check your spam folder — Brevo emails occasionally land there
            on first send.
          </P>

          <H3>Can I monitor non-HTTP services?</H3>
          <P>
            Currently wolfXmonitor monitors HTTP/HTTPS URLs only. TCP port monitoring and SSL expiry
            checks are on the roadmap.
          </P>

          <H3>What counts as a "down" event?</H3>
          <P>
            A monitor is marked down if the ping returns a non-2xx HTTP status code, the connection is
            refused, or the request times out. A single failed ping triggers the alert — there is no
            confirmation delay by default.
          </P>

          <H3>How do I cancel my Pro plan?</H3>
          <P>
            Contact the platform admin. Admins can manually downgrade any account from the Users tab in
            the Admin Panel.
          </P>

          <H3>Is the status page visible without an account?</H3>
          <P>
            Yes — <Code>monitor.xwolf.space/status</Code> and <Code>/status/:id</Code> are fully public.
            Anyone with the link can check the health of your monitored endpoints.
          </P>

          <div className="mt-16 pt-8 border-t border-border flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              wolfXmonitor · monitor.xwolf.space
            </span>
            <a
              href="https://github.com/WOLFTECH-254/wolfXmonitor/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              Report an issue <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </article>
      </div>
    </div>
  );
}
