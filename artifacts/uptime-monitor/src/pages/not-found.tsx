import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground px-6 dark">
      <Helmet>
        <title>404 Not Found — GuardiX</title>
      </Helmet>
      <div className="text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Error 404</div>
        <h1 className="font-display text-4xl md:text-5xl text-foreground mb-3">Page not found</h1>
        <p className="font-mono text-sm text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has moved.
        </p>
        <Link href="/">
          <button className="font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-6 py-2.5 rounded-md font-semibold tracking-wide">
            Back home
          </button>
        </Link>
      </div>
    </div>
  );
}
