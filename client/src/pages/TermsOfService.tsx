import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1 as any)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-foreground">Terms of Service</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 prose prose-sm dark:prose-invert text-foreground">
        <p className="text-xs text-muted-foreground mb-6">
          <strong>Effective Date:</strong> [Insert Date] &nbsp;|&nbsp; <strong>Company:</strong> Valisse Co LLC &nbsp;|&nbsp; <strong>Contact:</strong>{" "}
          <a href="mailto:info@valisseco.com" className="text-primary">info@valisseco.com</a>
        </p>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">1. Overview</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Valisse is a platform operated by Valisse Co LLC that connects clients with independent nail technicians for beauty services. By using Valisse, you agree to these Terms.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">2. Eligibility</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Users must be at least 18 years old to use the platform.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">3. Marketplace Disclaimer</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Valisse is a marketplace only. Nail technicians are independent contractors, not employees. Valisse does not provide nail services and is not responsible for service quality, outcomes, injuries, or disputes.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">4. Accounts</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You agree to provide accurate information and keep your login credentials secure. We may suspend or terminate accounts at any time.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">5. Bookings &amp; Payments</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Bookings may be made through the platform. Payments may occur in-app or directly with the nail technician.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
            <strong>Subscriptions (Nail Techs):</strong> 1 free month; +1 additional free month if 50 followers are reached; then $9.99/month.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">6. Refunds</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            All payments are non-refundable unless required by law.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">7. Cancellations &amp; No-Shows</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cancellation and no-show policies are set by individual nail technicians. Valisse is not responsible for enforcement or refunds.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">8. Messaging &amp; SMS</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You consent to receive appointment confirmations, reminders, and follow-ups. You may opt out of SMS communications at any time.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">9. User Content</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By posting content, you grant Valisse a license to use and display it. You confirm you own the rights to your content. We may remove content at our discretion.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">10. Prohibited Conduct</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Users may not post stolen or inappropriate content, harass others, or misrepresent their identity or services.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">11. Limitation of Liability</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Valisse Co LLC is not liable for service outcomes, injuries, or disputes. Use of the platform is at your own risk.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">12. Modifications</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update these Terms at any time. Continued use of the platform constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">13. Contact</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <a href="mailto:info@valisseco.com" className="text-primary">info@valisseco.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}
