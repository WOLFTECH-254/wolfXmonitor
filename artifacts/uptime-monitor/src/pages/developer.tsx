import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { Github, Twitter, Linkedin, Globe, Coffee, ExternalLink, Star, GitFork, Users, BookOpen, Zap, ArrowRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DevProfile {
  name: string;
  title: string;
  bio: string;
  avatarUrl: string;
  githubUsername: string;
  githubUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  websiteUrl: string;
  coffeeUrl: string;
  customLinks: { label: string; url: string }[];
}

interface GithubProfile {
  followers: number;
  following: number;
  public_repos: number;
  public_gists: number;
  name: string;
  bio: string;
  avatar_url: string;
  html_url: string;
  blog: string;
  location: string;
  company: string;
}

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-4 bg-background border border-border rounded">
      <span className="font-display text-3xl text-foreground">{value}</span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

export default function DeveloperPage() {
  const { data: profile, isLoading } = useQuery<DevProfile>({
    queryKey: ["dev-profile"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/settings/developer`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: gh } = useQuery<GithubProfile>({
    queryKey: ["github-profile", profile?.githubUsername],
    queryFn: async () => {
      const res = await fetch(`https://api.github.com/users/${profile!.githubUsername}`);
      if (!res.ok) throw new Error("GitHub fetch failed");
      return res.json();
    },
    enabled: !!profile?.githubUsername,
    staleTime: 10 * 60 * 1000,
  });

  const displayName  = profile?.name || gh?.name || "The Developer";
  const displayTitle = profile?.title || "Full Stack Developer";
  const displayBio   = profile?.bio || gh?.bio || "";
  const avatarSrc    = profile?.avatarUrl || gh?.avatar_url || "";
  const githubHref   = profile?.githubUrl || (profile?.githubUsername ? `https://github.com/${profile.githubUsername}` : "");

  const socialLinks = [
    githubHref     && { href: githubHref,          Icon: Github,   label: "GitHub",   cta: "Follow on GitHub", primary: true },
    profile?.coffeeUrl   && { href: profile.coffeeUrl,   Icon: Coffee,   label: "Buy Me a Coffee", cta: "Buy Me a Coffee", primary: false },
    profile?.twitterUrl  && { href: profile.twitterUrl,  Icon: Twitter,  label: "Twitter / X",     cta: "Follow on X",      primary: false },
    profile?.linkedinUrl && { href: profile.linkedinUrl, Icon: Linkedin, label: "LinkedIn",         cta: "Connect",           primary: false },
    profile?.websiteUrl  && { href: profile.websiteUrl,  Icon: Globe,    label: "Website",          cta: "Visit Website",     primary: false },
  ].filter(Boolean) as { href: string; Icon: React.ComponentType<{ className?: string }>; label: string; cta: string; primary: boolean }[];

  const customLinks = profile?.customLinks ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <Helmet>
        <title>Developer — GuardiX</title>
        <meta name="description" content={`Meet the developer behind GuardiX — ${displayName}`} />
      </Helmet>

      {/* Top nav bar */}
      <nav className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-display text-lg tracking-wide text-foreground">
              Guardi<span className="text-primary">X</span>
            </span>
          </Link>
          <Link href="/" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            ← Back to app
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-16">

        {/* Hero: avatar + name + bio */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="font-mono text-xs text-muted-foreground animate-pulse tracking-widest uppercase">Loading profile…</div>
          </div>
        ) : (
          <>
            {/* Profile card */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
              {/* Avatar */}
              <div className="shrink-0">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    className="w-32 h-32 rounded-full border-2 border-primary/30 object-cover"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full border-2 border-primary/30 bg-primary/5 flex items-center justify-center">
                    <span className="font-display text-5xl text-primary/40">{displayName.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 space-y-3 text-center sm:text-left">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">Developer</p>
                  <h1 className="font-display text-4xl md:text-5xl uppercase tracking-wide text-foreground">{displayName}</h1>
                  <p className="font-mono text-sm text-muted-foreground mt-1">{displayTitle}</p>
                </div>
                {displayBio && (
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-lg">
                    {displayBio}
                  </p>
                )}
                {gh?.location && (
                  <p className="font-mono text-[11px] text-muted-foreground/60">📍 {gh.location}</p>
                )}
              </div>
            </div>

            {/* GitHub stats */}
            {gh && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">GitHub Stats</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatPill label="Followers"    value={gh.followers} />
                  <StatPill label="Following"    value={gh.following} />
                  <StatPill label="Repositories" value={gh.public_repos} />
                  <StatPill label="Gists"        value={gh.public_gists} />
                </div>
              </div>
            )}

            {/* Quick Links */}
            {socialLinks.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Connect</p>
                <div className="flex flex-wrap gap-3">
                  {socialLinks.map(({ href, Icon, label, cta, primary }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded font-mono text-xs tracking-wide transition-all ${
                        primary
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                          : "border border-border bg-card text-foreground hover:border-primary/50 hover:text-primary"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {cta}
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Custom links */}
            {customLinks.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">More Links</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {customLinks.map(({ label, url }) => (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 px-4 py-3 border border-border bg-card rounded hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                      <span className="font-mono text-sm text-foreground group-hover:text-primary transition-colors">{label}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* About the app section */}
            <div className="border border-border bg-card rounded p-8 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-2xl uppercase tracking-wide">About GuardiX</h2>
              </div>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                GuardiX is a full-stack uptime monitoring platform built for developers and businesses who need to know the moment their services go down.
                Real-time alerts via email, Telegram, WhatsApp, and Discord — with a clean dark interface designed for 24/7 reliability.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/signup"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-mono text-xs font-bold hover:bg-primary/90 transition-colors">
                  <Zap className="w-3.5 h-3.5" />
                  Start Monitoring Free
                </Link>
                <Link href="/docs"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-background text-foreground rounded font-mono text-xs hover:border-primary/50 transition-colors">
                  <BookOpen className="w-3.5 h-3.5" />
                  Documentation
                </Link>
                <Link href="/status"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-background text-foreground rounded font-mono text-xs hover:border-primary/50 transition-colors">
                  <Star className="w-3.5 h-3.5" />
                  System Status
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer strip */}
      <footer className="border-t border-border mt-16 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
            © {new Date().getFullYear()} GuardiX
          </p>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/50">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
            Powered by WOLF TECH
          </div>
        </div>
      </footer>
    </div>
  );
}
