import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Zap, Twitter, Instagram, Facebook, Linkedin, Youtube } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SiteSettings {
  twitterUrl: string; instagramUrl: string; facebookUrl: string;
  linkedinUrl: string; youtubeUrl: string;
  privacyUrl: string; termsUrl: string; tagline: string;
}

const SOCIALS = [
  { key: "twitterUrl",   Icon: Twitter,  label: "Twitter / X" },
  { key: "instagramUrl", Icon: Instagram, label: "Instagram" },
  { key: "facebookUrl",  Icon: Facebook,  label: "Facebook" },
  { key: "linkedinUrl",  Icon: Linkedin,  label: "LinkedIn" },
  { key: "youtubeUrl",   Icon: Youtube,   label: "YouTube" },
] as const;

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
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">

          {/* Brand */}
          <div className="flex flex-col gap-2.5">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center group-hover:border-primary/70 transition-colors">
                <Zap className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="font-display text-lg text-foreground">
                wolf<span className="text-primary">X</span>monitor
              </span>
            </Link>
            <p className="font-mono text-[11px] text-muted-foreground max-w-[220px] leading-relaxed">
              {data?.tagline || "Keeping your apps alive, 24/7."}
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-5">
            {/* Quick links */}
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-3">Quick Links</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <Link href="/status" className="font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors">System Status</Link>
                <Link href="/signup" className="font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors">Get Started</Link>
                <Link href="/signin" className="font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors">Log In</Link>
              </div>
            </div>

            {/* Policy links */}
            {(data?.privacyUrl || data?.termsUrl) && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-3">Legal</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {data?.privacyUrl && (
                    <a href={data.privacyUrl} target="_blank" rel="noreferrer"
                      className="font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors">
                      Privacy Policy
                    </a>
                  )}
                  {data?.termsUrl && (
                    <a href={data.termsUrl} target="_blank" rel="noreferrer"
                      className="font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors">
                      Terms of Service
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Social icons */}
          {activeSocials.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">Follow Us</p>
              <div className="flex items-center gap-2 flex-wrap">
                {activeSocials.map(({ key, Icon, label }) => (
                  <a key={key} href={data![key]} target="_blank" rel="noreferrer" aria-label={label}
                    className="w-8 h-8 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all">
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
            © {year} wolfXmonitor. All rights reserved.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <p className="font-mono text-[10px] text-muted-foreground/50 tracking-wider">
              Powered by <span className="text-primary/70 font-bold">WOLF TECH</span> · Silent Wolf
            </p>
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/50">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              All systems monitored
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
