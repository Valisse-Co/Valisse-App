import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1 as any)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-foreground">Privacy Policy</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 text-foreground">
        <p className="text-xs text-muted-foreground mb-6">
          <strong>Effective Date:</strong> [Insert Date] &nbsp;|&nbsp; <strong>Company:</strong> Valisse Co LLC &nbsp;|&nbsp; <strong>Contact:</strong>{" "}
          <a href="mailto:info@valisseco.com" className="text-primary">info@valisseco.com</a>
        </p>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">1. Information We Collect</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We collect name, email, and login information; booking, messaging, and activity data; uploaded photos and content; and location data to provide our services.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">2. How We Use Information</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We use your information to provide booking functionality, connect clients and nail techs, send reminders and updates, and improve the platform.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">3. Third-Party Services</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We use trusted providers including Stripe for payment processing and Twilio for SMS communications.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">4. Data Sharing</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We do not sell your data. We may share data between users on the platform, with service providers who help operate the platform, or when required by law.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">5. Data Retention</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We retain your data for as long as necessary to operate the platform and fulfill legal obligations.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">6. Your Rights</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You may request access to or deletion of your personal data by contacting us at{" "}
            <a href="mailto:info@valisseco.com" className="text-primary">info@valisseco.com</a>.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">7. Security</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We use reasonable technical and organizational safeguards and rely on secure third-party services to protect your data.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">8. SMS &amp; Communications</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By providing your phone number, you consent to receive booking confirmations, appointment reminders, and review requests via SMS. You may opt out at any time by replying STOP or updating your preferences in the app.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">9. Changes to This Policy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update this Privacy Policy at any time. We will notify you of material changes through the app or by email.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">10. Contact</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <a href="mailto:info@valisseco.com" className="text-primary">info@valisseco.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}
