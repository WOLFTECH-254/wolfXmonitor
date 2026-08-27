import { useQuery } from "@tanstack/react-query";
import { FaGoogle, FaGithub } from "react-icons/fa";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Providers {
  google: boolean;
  github: boolean;
}

/**
 * Google / GitHub sign-in buttons. Renders nothing unless at least one
 * provider is configured in the admin panel. Uses a full-page redirect
 * (OAuth can't run over fetch).
 */
export function SocialAuthButtons({ className = "" }: { className?: string }) {
  const { data } = useQuery<Providers>({
    queryKey: ["oauth-providers"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/auth/oauth/providers`);
      return res.ok ? res.json() : { google: false, github: false };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!data || (!data.google && !data.github)) return null;

  const go = (provider: "google" | "github") => {
    window.location.href = `${BASE}/api/auth/oauth/${provider}`;
  };

  const btn =
    "w-full flex items-center justify-center gap-2.5 font-mono text-sm border border-border bg-card text-foreground " +
    "hover:border-primary/50 hover:text-primary transition-colors py-3 rounded";

  return (
    <div className={className}>
      <div className="space-y-2.5">
        {data.google && (
          <button type="button" onClick={() => go("google")} className={btn}>
            <FaGoogle className="w-4 h-4" /> Continue with Google
          </button>
        )}
        {data.github && (
          <button type="button" onClick={() => go("github")} className={btn}>
            <FaGithub className="w-4 h-4" /> Continue with GitHub
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 my-6">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
