import { BrandMark } from "@/components/brand-mark";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { ExternalLink } from "lucide-react";

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-xl tracking-wide text-foreground mt-12 mb-3 flex items-center gap-3">
      <span className="text-primary">#</span> {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-4">{children}</p>;
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="font-mono text-sm text-muted-foreground leading-relaxed mb-1.5 flex gap-2">
      <span className="text-primary shrink-0">—</span>
      <span>{children}</span>
    </li>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <Helmet>
        <title>Privacy Policy — GuardiX</title>
        <meta name="description" content="Privacy Policy for GuardiX — what data we collect, how we use it, and your rights." />
      </Helmet>

      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
              <BrandMark className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-display text-lg tracking-wide">
              Guardi<span className="text-primary">X</span>
            </span>
            <span className="hidden sm:block font-mono text-xs text-muted-foreground ml-1">/ privacy</span>
          </Link>
          <Link href="/docs" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Docs
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-12">
        <div className="mb-10">
          <h1 className="font-display text-3xl tracking-wide text-foreground mb-3">
            Privacy Policy
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            Effective date: <span className="text-foreground">May 3, 2026</span> · Last updated: <span className="text-foreground">May 3, 2026</span>
          </p>
        </div>

        <P>
          GuardiX ("we", "the platform") is operated by WOLF TECH. This policy explains what data
          we collect when you use <strong className="text-foreground">monitor.xwolf.space</strong>, how
          we use it, and your rights over it. We collect only what is necessary to run the service.
        </P>

        <H2>1. What We Collect</H2>
        <ul className="mb-6 space-y-1">
          <Li><strong className="text-foreground">Account data</strong> — your name and email address, provided at registration.</Li>
          <Li><strong className="text-foreground">Monitor data</strong> — URLs you add for monitoring, check intervals, and ping results (status, response time, error reason, timestamp).</Li>
          <Li><strong className="text-foreground">Alert channel settings</strong> — Telegram Chat ID, WhatsApp phone number, and/or Discord webhook URL, only if you choose to add them.</Li>
          <Li><strong className="text-foreground">Payment data</strong> — payments are processed by Paystack. We store your plan status (free/pro) and payment reference only. Card numbers and M-Pesa details are never stored by us.</Li>
          <Li><strong className="text-foreground">Security logs</strong> — failed login attempts and brute-force events are logged with timestamp and IP address for fraud prevention.</Li>
          <Li><strong className="text-foreground">Session data</strong> — an encrypted session cookie is stored in your browser to keep you logged in.</Li>
        </ul>
        <P>We do not use tracking pixels, third-party analytics, or advertising cookies.</P>

        <H2>2. How We Use Your Data</H2>
        <ul className="mb-6 space-y-1">
          <Li>To ping your monitored URLs and record their health.</Li>
          <Li>To send downtime and recovery alerts to your chosen channels (email, Telegram, WhatsApp, Discord).</Li>
          <Li>To process plan upgrades and verify payments via Paystack webhooks.</Li>
          <Li>To authenticate you and maintain your session securely.</Li>
          <Li>To detect and block abusive login attempts.</Li>
        </ul>

        <H2>3. Third-Party Services</H2>
        <P>Alert delivery and payment processing involve the following providers. Each receives only the minimum data required for their function:</P>
        <ul className="mb-6 space-y-1">
          <Li><strong className="text-foreground">Brevo</strong> (email alerts) — receives your email address and the alert message content. <a href="https://www.brevo.com/legal/privacypolicy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Privacy policy <ExternalLink className="w-3 h-3" /></a></Li>
          <Li><strong className="text-foreground">Telegram Bot API</strong> — receives your Chat ID and the alert message. <a href="https://telegram.org/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Privacy policy <ExternalLink className="w-3 h-3" /></a></Li>
          <Li><strong className="text-foreground">Twilio</strong> (WhatsApp alerts) — receives your phone number and the alert message. <a href="https://www.twilio.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Privacy policy <ExternalLink className="w-3 h-3" /></a></Li>
          <Li><strong className="text-foreground">Discord</strong> (webhook alerts) — receives the alert embed sent to your webhook URL. <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Privacy policy <ExternalLink className="w-3 h-3" /></a></Li>
          <Li><strong className="text-foreground">Paystack</strong> (payments) — handles all payment processing. We receive a verification token and your plan status. <a href="https://paystack.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Privacy policy <ExternalLink className="w-3 h-3" /></a></Li>
        </ul>

        <H2>4. Data Storage & Security</H2>
        <P>
          All data is stored in a PostgreSQL database on a privately managed VPS (Xcasper Hosting, Kenya).
          Passwords are hashed with bcrypt before storage — we never store plaintext passwords. Sessions are
          encrypted using a server-side secret. The server runs behind Nginx with TLS enforced on all connections.
        </P>
        <P>
          Ping history and incident logs are retained indefinitely while your account is active. No automatic
          purge is applied — contact the admin to request deletion of specific records.
        </P>

        <H2>5. Your Rights</H2>
        <ul className="mb-6 space-y-1">
          <Li><strong className="text-foreground">Access</strong> — you can view all your monitors, ping history, and profile data from the dashboard at any time.</Li>
          <Li><strong className="text-foreground">Update</strong> — you can edit your name, notification email, and alert channels from the Profile and Integrations pages.</Li>
          <Li><strong className="text-foreground">Delete</strong> — contact the admin to permanently delete your account and all associated data.</Li>
          <Li><strong className="text-foreground">Export</strong> — ping history is available via the API at <code className="bg-muted/40 border border-border rounded px-1.5 py-0.5 font-mono text-xs text-primary">/api/monitors/:id/pings</code>.</Li>
        </ul>

        <H2>6. Cookies</H2>
        <P>
          We use a single session cookie (<code className="bg-muted/40 border border-border rounded px-1.5 py-0.5 font-mono text-xs text-primary">connect.sid</code>) to keep you logged in.
          It is HTTP-only, scoped to this domain, and expires when you log out or your session times out.
          No advertising or tracking cookies are set.
        </P>

        <H2>7. Children</H2>
        <P>
          GuardiX is not directed at children under 13. We do not knowingly collect data from anyone
          under 13. If you believe we have done so inadvertently, contact us and we will delete it promptly.
        </P>

        <H2>8. Changes to This Policy</H2>
        <P>
          We may update this policy as the service evolves. The effective date at the top of this page
          will be updated when changes are made. Continued use of GuardiX after changes are posted
          constitutes acceptance of the updated policy.
        </P>

        <H2>9. Contact</H2>
        <P>
          Questions about this policy or data requests can be directed to the platform admin via the
          GitHub repository or by emailing the address shown in the Admin panel.
        </P>

        <div className="mt-16 pt-8 border-t border-border flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">GuardiX · monitor.xwolf.space</span>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors">
              Documentation
            </Link>
            <a
              href="https://github.com/WOLFTECH-254/wolfXmonitor"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              GitHub <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
