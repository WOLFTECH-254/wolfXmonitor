import { BrandMark } from "@/components/brand-mark";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Twitter, Instagram, Facebook, Linkedin, Youtube, Zap, Activity, Bell, BarChart2, Globe, ShieldCheck, BookOpen, Mail, FileText, Lock } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SiteSettings {
  twitterUrl: string; instagramUrl: string; facebookUrl: string;
  linkedinUrl: string; youtubeUrl: string;
  privacyUrl: string; termsUrl: string; tagline: string;
}

const SOCIALS = [
  { key: "twitterUrl",   Icon: Twitter,   label: "Twitter / X" },
  { key: "instagramUrl", Icon: Instagram,  label: "Instagram" },
  { key: "facebookUrl",  Icon: Facebook,   label: "Facebook" },
  { key: "linkedinUrl",  Icon: Linkedin,   label: "LinkedIn" },
  { key: "youtubeUrl",   Icon: Youtube,    label: "YouTube" },
] as const;

const PRODUCT_LINKS = [
  { href: "/status",   label: "System Status",   Icon: Activity },
  { href: "/pricing",  label: "Pricing",          Icon: BarChart2 },
  { href: "/signup",   label: "Get Started Free", Icon: Zap },
  { href: "/signin",   label: "Log In",           Icon: Globe },
  { href: "/docs",     label: "Documentation",    Icon: FileText },
];

const FEATURES_LINKS = [
  { label: "Uptime Monitoring",  Icon: Activity },
  { label: "Instant Alerts",     Icon: Bell },
  { label: "Response Times",     Icon: BarChart2 },
  { label: "Multi-Region Pings", Icon: Globe },
  { label: "Status Pages",       Icon: ShieldCheck },
];

const COMPANY_LINKS = [
  { href: "https://xwolf.space",           label: "About Wolf Tech",    Icon: BookOpen,    external: true },
  { href: "mailto:wolfsilent906@gmail.com", label: "Contact Support",    Icon: Mail,        external: true },
  { href: "/developer",                    label: "Developer",          Icon: BookOpen,    external: false },
];

export function Footer() {
  const { data } = useQuery<SiteSettings>({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/settings/site`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const activeSocials = SOCIALS.filter(s => !!data?.[s.key]);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-16">

        {/* Main grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-14">

          {/* Col 1 — Brand */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center group-hover:border-primary/70 transition-colors">
                <BrandMark className="w-4 h-4 text-primary" />
              </div>
              <span className="font-display text-xl text-foreground">
                Guardi<span className="text-primary">X</span>
              </span>
            </Link>
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed max-w-[200px]">
              {data?.tagline || "Keeping your apps alive, 24/7. Built for developers who hate downtime."}
            </p>
            {/* Social icons */}
            {activeSocials.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {activeSocials.map(({ key, Icon, label }) => (
                  <a key={key} href={data![key]} target="_blank" rel="noreferrer" aria-label={label}
                    className="w-8 h-8 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all">
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {[Twitter, Instagram, Facebook].map((Icon, i) => (
                  <div key={i} className="w-8 h-8 rounded border border-border/40 flex items-center justify-center text-muted-foreground/30">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Col 2 — Product */}
          <div className="flex flex-col gap-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-primary/70 font-bold">Product</p>
            <ul className="flex flex-col gap-3">
              {PRODUCT_LINKS.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link href={href}
                    className="group flex items-center gap-2 font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors">
                    <Icon className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary/60 transition-colors flex-shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Features */}
          <div className="flex flex-col gap-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-primary/70 font-bold">Features</p>
            <ul className="flex flex-col gap-3">
              {FEATURES_LINKS.map(({ label, Icon }) => (
                <li key={label} className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground/60">
                  <Icon className="w-3 h-3 text-primary/30 flex-shrink-0" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Company / Legal */}
          <div className="flex flex-col gap-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-primary/70 font-bold">Company</p>
            <ul className="flex flex-col gap-3">
              {COMPANY_LINKS.map(({ href, label, Icon, external }) => (
                <li key={label}>
                  {external ? (
                    <a href={href} target="_blank" rel="noreferrer"
                      className="group flex items-center gap-2 font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors">
                      <Icon className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary/60 transition-colors flex-shrink-0" />
                      {label}
                    </a>
                  ) : (
                    <Link href={href}
                      className="group flex items-center gap-2 font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors">
                      <Icon className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary/60 transition-colors flex-shrink-0" />
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            {/* Legal */}
            <p className="font-mono text-[9px] uppercase tracking-widest text-primary/70 font-bold mt-2">Legal</p>
            <ul className="flex flex-col gap-3">
              <li>
                <Link href="/privacy"
                  className="group flex items-center gap-2 font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors">
                  <Lock className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary/60 transition-colors flex-shrink-0" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/docs"
                  className="group flex items-center gap-2 font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors">
                  <FileText className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary/60 transition-colors flex-shrink-0" />
                  Documentation
                </Link>
              </li>
              {data?.termsUrl && (
                <li>
                  <a href={data.termsUrl} target="_blank" rel="noreferrer"
                    className="font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors">
                    Terms of Service
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-14 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
            © {year} GuardiX · All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/50">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
              All systems monitored
            </div>
            <p className="font-mono text-[10px] text-muted-foreground/40 tracking-wider">
              Powered by <span className="text-primary/60 font-bold">WOLF TECH</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
