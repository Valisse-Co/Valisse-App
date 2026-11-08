import { Link } from "wouter";

export default function AppFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`border-t border-border/70 bg-card/60 px-5 pt-8 pb-10 text-center text-xs text-muted-foreground ${className}`}
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <img
          src="/manus-storage/valisse_logo_transparent_b005737c.png"
          alt="Valisse"
          className="w-7 h-7 object-contain"
        />
        <span className="font-display text-lg font-light tracking-widest text-foreground">
          Valisse
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">Book the Look You Love</p>

      <nav
        aria-label="Legal and support links"
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs mb-4"
      >
        <Link href="/discover" className="hover:text-foreground transition-colors">
          Discover
        </Link>
        <Link href="/terms" className="hover:text-foreground transition-colors">
          Terms of Service
        </Link>
        <Link href="/privacy" className="hover:text-foreground transition-colors">
          Privacy Policy
        </Link>
        <Link href="/support" className="hover:text-foreground transition-colors">
          Help &amp; Support
        </Link>
        <a
          href="mailto:info@valisseco.com?subject=Valisse%20Support"
          className="hover:text-foreground transition-colors text-primary"
        >
          Contact Us
        </a>
      </nav>

      <p className="text-[11px] text-muted-foreground/80 max-w-sm mx-auto leading-relaxed mb-3">
        Valisse is a marketplace connecting clients with independent beauty service
        professionals. Services, pricing, and appointments are provided solely by each
        independent technician.
      </p>

      <p className="text-[11px] text-muted-foreground/70">
        &copy; 2026 Valisse Co LLC. All rights reserved.
      </p>
    </footer>
  );
}
