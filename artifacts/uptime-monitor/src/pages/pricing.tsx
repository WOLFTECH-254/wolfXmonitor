import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BrandMark } from "@/components/brand-mark";
import { Footer } from "@/components/footer";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { PlanCards, type ApiPlan } from "@/components/plan-cards";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function PricingContent({ onSelect, currentSlug }: { onSelect: (p: ApiPlan) => void; currentSlug?: string | null }) {
  const { data: plans = [], isLoading } = useQuery<ApiPlan[]>({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/plans`);
      return res.ok ? res.json() : [];
    },
    staleTime: 60_000,
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="font-display text-[clamp(32px,6vw,56px)] text-foreground leading-tight">
          Simple, <span className="text-primary">honest</span> pricing
        </h1>
        <p className="font-mono text-sm text-muted-foreground mt-3">
          Every plan includes email alerts. Prices shown in USD.
        </p>
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => <div key={i} className="h-96 rounded-lg border border-border bg-card animate-pulse" />)}
        </div>
      ) : (
        <PlanCards plans={plans} currentSlug={currentSlug} onSelect={onSelect} ctaLabel="Get this plan" />
      )}
    </div>
  );
}

export default function PricingPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const onSelect = (p: ApiPlan) => {
    if (!user) { navigate(`/signup?plan=${p.slug}`); return; }
    if (p.isFree) { navigate("/dashboard"); return; }
    navigate(`/upgrade?plan=${p.slug}`);
  };

  const head = (
    <Helmet>
      <title>Pricing — GuardiX</title>
      <meta name="description" content="GuardiX plans — from a free tier to unlimited monitoring with 15-second checks." />
      <meta property="og:title" content="Pricing — GuardiX" />
      <link rel="canonical" href="https://guardix.wolvarex.com/pricing" />
    </Helmet>
  );

  if (user) {
    return (
      <Layout>
        {head}
        <div className="py-2">
          <PricingContent onSelect={onSelect} currentSlug={user.planSlug} />
        </div>
      </Layout>
    );
  }

  return (
    <>
      {head}
      <div className="min-h-screen bg-background text-foreground dark">
        <nav className="border-b border-border px-6 md:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
              <BrandMark className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display text-xl">Guardi<span className="text-primary">X</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/signin" className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2">Log In</Link>
            <Link href="/signup" className="font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-5 py-2 rounded-md font-semibold">Get Started</Link>
          </div>
        </nav>
        <div className="px-6 py-16">
          <PricingContent onSelect={onSelect} />
        </div>
        <Footer />
      </div>
    </>
  );
}
