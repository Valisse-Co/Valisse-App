import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-accent rounded-full animate-pulse" />
            <AlertCircle className="relative h-16 w-16 text-primary" />
          </div>
        </div>

        <h1 className="text-5xl font-display font-light text-foreground mb-2">404</h1>
        <h2 className="text-lg font-semibold text-foreground mb-3">Page Not Found</h2>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          Sorry, the page you're looking for doesn't exist.<br />
          It may have been moved or deleted.
        </p>

        <button
          onClick={() => setLocation("/")}
          className="btn-valisse inline-flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Go Home
        </button>
      </div>
    </div>
  );
}
