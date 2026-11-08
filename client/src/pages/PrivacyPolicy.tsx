import { useLocation } from "wouter";
import { ArrowLeft, ShieldCheck, Printer } from "lucide-react";

export default function PrivacyPolicy() {
  const [, navigate] = useLocation();

  const sections = [
    { id: "intro", title: "1. Introduction & Who We Are" },
    { id: "collected", title: "2. Information We Collect" },
    { id: "use", title: "3. How We Use Your Information" },
    { id: "sharing", title: "4. How We Share Your Information" },
    { id: "cookies", title: "5. Cookies & Tracking" },
    { id: "retention", title: "6. Data Retention" },
    { id: "security", title: "7. Data Security" },
    { id: "rights", title: "8. Your Privacy Rights & Choices" },
    { id: "sms", title: "9. SMS & Communications" },
    { id: "children", title: "10. Children's Privacy" },
    { id: "thirdparty", title: "11. Third-Party Services" },
    { id: "international", title: "12. International Data Transfers" },
    { id: "changes", title: "13. Changes to This Policy" },
    { id: "contact", title: "14. How to Contact Us" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                navigate("/discover");
              }
            }}
            aria-label="Go back"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-primary" />
            <h1 className="font-semibold text-foreground text-base">Privacy Policy</h1>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          aria-label="Print policy"
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Print this page"
        >
          <Printer size={18} />
        </button>
      </div>

      <main className="max-w-2xl mx-auto px-5 py-8 text-foreground">
        {/* Document metadata card */}
        <div className="rounded-2xl border border-border bg-card p-4 mb-8 text-xs text-muted-foreground space-y-1">
          <p>
            <strong className="text-foreground">Effective Date:</strong> November 8, 2026 &nbsp;|&nbsp;{" "}
            <strong className="text-foreground">Last Updated:</strong> November 8, 2026
          </p>
          <p>
            <strong className="text-foreground">Company:</strong> Valisse Co LLC &nbsp;|&nbsp;{" "}
            <strong className="text-foreground">Website:</strong> www.valisseco.com
          </p>
          <p>
            <strong className="text-foreground">Contact:</strong>{" "}
            <a href="mailto:info@valisseco.com" className="text-primary underline">
              info@valisseco.com
            </a>
          </p>
          <p className="pt-1 text-[11px] leading-relaxed">
            This Privacy Policy describes how Valisse Co LLC collects, uses, and shares personal
            information when you use the Valisse website, mobile app, and related services
            (collectively, the &ldquo;Platform&rdquo;).
          </p>
        </div>

        {/* Quick jump */}
        <nav aria-label="Table of contents" className="mb-8 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Table of Contents
          </p>
          <ol className="columns-1 sm:columns-2 gap-3 text-xs space-y-1 text-primary">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Section 1 */}
        <section id="intro" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">1. Introduction &amp; Who We Are</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            Valisse (&ldquo;Valisse,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is
            operated by Valisse Co LLC. Valisse is an online marketplace that connects beauty
            clients (&ldquo;Clients&rdquo;) with independent nail technicians and other beauty service
            professionals (&ldquo;Nail Techs&rdquo; or &ldquo;Technicians&rdquo;). Valisse is a
            technology platform only; we are not an employer, salon, agency, or service provider of
            nail or beauty services.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By accessing or using the Platform, you acknowledge that you have read and understood
            this Privacy Policy. If you do not agree, please do not use the Platform.
          </p>
        </section>

        {/* Section 2 */}
        <section id="collected" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            We collect information you provide directly, information collected automatically, and
            information received from third parties.
          </p>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <div>
              <strong className="text-foreground">a. Information You Provide</strong>
              <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                <li>
                  <span className="text-foreground font-medium">Account data:</span> full name, email
                  address, phone number, login credentials, and account role (Client or Nail Tech).
                </li>
                <li>
                  <span className="text-foreground font-medium">Profile and business data:</span>{" "}
                  profile photo, biography, style/color preferences, business name, business address,
                  license number, years of experience, service menu and pricing, and Instagram
                  handle (for Nail Techs).
                </li>
                <li>
                  <span className="text-foreground font-medium">Booking data:</span> appointment
                  details (service, date, time, price, notes), appointment codes, booking status, and
                  appointment history.
                </li>
                <li>
                  <span className="text-foreground font-medium">Communications:</span> in-app
                  messages between Clients and Nail Techs, SMS consent preferences, notification
                  preferences, and support inquiries.
                </li>
                <li>
                  <span className="text-foreground font-medium">Content and media:</span> photos of
                  nail work you upload, captions, reviews, ratings, and collections/saved boards.
                </li>
                <li>
                  <span className="text-foreground font-medium">Survey and match data:</span> answers
                  you provide to the Smart Service Match questionnaire and any inspiration photos you
                  upload.
                </li>
              </ul>
            </div>
            <div>
              <strong className="text-foreground">b. Payment Information</strong>
              <p className="text-xs mt-1">
                Payments and subscriptions are processed by our payment partner, Stripe. Valisse
                never stores your full payment card number, CVV, or expiration date. Stripe stores
                and processes this data in accordance with PCI-DSS standards and its own privacy
                policy (stripe.com/privacy). We retain only payment references (e.g., Stripe
                customer ID, payment intent IDs) and transaction metadata necessary to operate the
                service.
              </p>
            </div>
            <div>
              <strong className="text-foreground">c. Location Information</strong>
              <p className="text-xs mt-1">
                With your permission, we collect your approximate device location to power
                proximity search and the &ldquo;Near Me&rdquo; map. We may also collect the city and
                ZIP code you provide. For Nail Techs, we calculate approximate (&ldquo;fuzzed&rdquo;)
                coordinates for public display to protect your exact address; Clients only see a
                full appointment address after a booking is confirmed.
              </p>
            </div>
            <div>
              <strong className="text-foreground">d. Information Collected Automatically</strong>
              <p className="text-xs mt-1">
                We automatically collect log data such as IP address, browser type, device
                identifiers, referring pages, access times, pages viewed, post views, and saves,
                used to operate, secure, and improve the Platform.
              </p>
            </div>
            <div>
              <strong className="text-foreground">e. Information from Third Parties</strong>
              <p className="text-xs mt-1">
                If you sign in using a third-party service (such as Google or Manus OAuth), we
                receive basic profile information (e.g., name, email, open ID) from that provider as
                permitted by your account settings there.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section id="use" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground leading-relaxed">
            <li>To create and administer your account, and verify your identity</li>
            <li>To enable booking, scheduling, and payment of nail and beauty appointments</li>
            <li>To connect Clients and Nail Techs, and facilitate messaging and appointment coordination</li>
            <li>To send transactional messages, confirmations, reminders, and service updates by SMS, email, or in-app notification</li>
            <li>To provide the Discover feed, Smart Service Match recommendations, and proximity search</li>
            <li>To process subscriptions, payouts, and dispute handling</li>
            <li>To display reviews, ratings, and portfolio content you choose to publish</li>
            <li>To detect, investigate, and prevent fraudulent, abusive, or illegal activity and enforce our Terms of Service</li>
            <li>To measure engagement, analyze trends, and improve Platform performance and usability</li>
            <li>To comply with legal, tax, accounting, and regulatory obligations</li>
            <li>For any other purpose with your consent or at your direction</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section id="sharing" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">4. How We Share Your Information</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            <strong className="text-foreground">We do not sell your personal information.</strong> We
            share information only in the limited circumstances described below:
          </p>
          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <div>
              <strong className="text-foreground">With other Platform users:</strong> booking
              details are shared between the Client and Nail Tech involved in an appointment. Client
              names appear on reviews they publish. Technician profiles, portfolios, and reviews are
              publicly visible on the Platform. Clients can hide their booking history and profile in
              their privacy settings.
            </div>
            <div>
              <strong className="text-foreground">With service providers:</strong> trusted third
              parties that help us operate the Platform under contractual confidentiality and data
              protection obligations, including Stripe (payments), Telnyx (SMS delivery), Resend
              (transactional email), cloud hosting and database providers, mapping/geocoding
              services, and analytics tools.
            </div>
            <div>
              <strong className="text-foreground">For safety, legal, and compliance reasons:</strong>{" "}
              we may disclose information if required by law, subpoena, or court order, or when we
              believe disclosure is necessary to protect the rights, property, safety, or security of
              Valisse, our users, or the public.
            </div>
            <div>
              <strong className="text-foreground">Business transfers:</strong> in connection with a
              merger, acquisition, financing, reorganization, or sale of company assets, personal
              information may be transferred as part of the transaction.
            </div>
            <div>
              <strong className="text-foreground">With your consent:</strong> in any other situation
              where you have given us permission to share your information.
            </div>
          </div>
        </section>

        {/* Section 5 */}
        <section id="cookies" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">5. Cookies &amp; Tracking Technologies</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We use essential session cookies to keep you signed in, to verify security tokens, and to
            remember your preferences (such as theme choice). We may also use privacy-focused
            analytics tools to understand aggregate Platform usage. You can control cookie behavior
            through your browser settings; however, disabling certain cookies may prevent the
            Platform from functioning properly. Note that we do not track you across unrelated
            third-party websites.
          </p>
        </section>

        {/* Section 6 */}
        <section id="retention" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">6. Data Retention</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We retain personal information for as long as your account is active or as necessary to
            provide you with services, resolve disputes, enforce agreements, and satisfy legal, tax,
            and accounting requirements. When information is no longer needed, we securely delete or
            anonymize it. If you request account deletion, we will delete or anonymize your personal
            data within a reasonable time, except where retention is required by law.
          </p>
        </section>

        {/* Section 7 */}
        <section id="security" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">7. Data Security</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We implement reasonable technical and organizational measures to protect personal
            information against unauthorized access, loss, misuse, or alteration. These measures
            include encryption in transit (HTTPS/TLS), secure credential hashing, role-based access
            controls, and the use of vetted service providers. However, no internet transmission or
            electronic storage system is completely secure, and we cannot guarantee absolute
            security.
          </p>
        </section>

        {/* Section 8 */}
        <section id="rights" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">8. Your Privacy Rights &amp; Choices</h2>
          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <div>
              <strong className="text-foreground">Access, correction, and deletion:</strong> you may
              review, update, or request deletion of your personal data at any time by editing your
              profile or emailing{" "}
              <a href="mailto:info@valisseco.com?subject=Privacy%20Request" className="text-primary underline">
                info@valisseco.com
              </a>
              .
            </div>
            <div>
              <strong className="text-foreground">In-app privacy controls:</strong> from your
              settings you can toggle your profile visibility, hide booking history, hide yourself
              from proximity results, manage who can message you, and adjust notification channels.
            </div>
            <div>
              <strong className="text-foreground">Account deactivation:</strong> you may deactivate
              your account from Settings &gt; Account. Deactivated accounts can be reactivated at any
              time by signing back in.
            </div>
            <div>
              <strong className="text-foreground">Marketing communications:</strong> you can opt
              out of non-transactional emails using the unsubscribe link in the message, or by
              contacting us. Transactional messages (e.g., booking confirmations and security
              notices) cannot be opted out of while you use the service.
            </div>
            <div>
              <strong className="text-foreground">California Privacy Notice (CCPA / CPRA):</strong>{" "}
              California residents have the right to know what personal information we collect, use,
              disclose, and (if applicable) sell; the right to delete personal information; the right
              to correct inaccurate information; the right to opt out of the sale or sharing of
              personal information; and the right not to receive discriminatory treatment for
              exercising these rights. As stated above,{" "}
              <span className="text-foreground font-semibold">
                Valisse does not sell personal information
              </span>
              . To exercise any of these rights, email{" "}
              <a href="mailto:info@valisseco.com?subject=CCPA%20Request" className="text-primary underline">
                info@valisseco.com
              </a>{" "}
              with &ldquo;California Privacy Request&rdquo; in the subject line. We may verify your
              identity before fulfilling your request.
            </div>
          </div>
        </section>

        {/* Section 9 */}
        <section id="sms" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">9. SMS &amp; Communications</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            By providing your phone number during onboarding and checking the SMS consent box, you
            agree to receive transactional text messages from Valisse, including booking
            confirmations, appointment reminders, appointment verification codes, and review
            requests.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground leading-relaxed">
            <li>Message frequency varies based on your appointment activity.</li>
            <li>Message and data rates may apply depending on your mobile carrier.</li>
            <li>
              You may opt out of SMS messages at any time by replying{" "}
              <span className="font-semibold text-foreground">STOP</span> to any message you receive
              from us, or by updating your notification preferences in your app settings.
            </li>
            <li>
              For help, reply <span className="font-semibold text-foreground">HELP</span> or contact{" "}
              <a href="mailto:info@valisseco.com" className="text-primary underline">
                info@valisseco.com
              </a>
              .
            </li>
          </ul>
        </section>

        {/* Section 10 */}
        <section id="children" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">10. Children&rsquo;s Privacy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Platform is intended only for individuals who are at least 18 years old. We do not
            knowingly collect personal information from children under the age of 13. If we become
            aware that a child under 13 has provided us with personal information, we will take
            steps to delete such information promptly. If you believe a child has provided us with
            personal information, please contact us at{" "}
            <a href="mailto:info@valisseco.com?subject=Children%27s%20Privacy" className="text-primary underline">
              info@valisseco.com
            </a>
            .
          </p>
        </section>

        {/* Section 11 */}
        <section id="thirdparty" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">11. Third-Party Services</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Platform may contain links to third-party websites or services (for example,
            technicians&rsquo; Instagram accounts, payment providers, or app stores). We are not
            responsible for the privacy practices or content of these third parties. We encourage
            you to review the privacy policies of any third-party service you visit.
          </p>
        </section>

        {/* Section 12 */}
        <section id="international" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">12. International Data Transfers</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Valisse operates in the United States and its servers and service providers are located in
            the United States. If you access the Platform from outside the United States, your
            information will be transferred to and processed in the United States, where data
            protection laws may differ from those in your jurisdiction.
          </p>
        </section>

        {/* Section 13 */}
        <section id="changes" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">13. Changes to This Privacy Policy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time to reflect changes in our practices or
            legal requirements. When we make material changes, we will update the &ldquo;Effective
            Date&rdquo; above and notify you through the Platform or by email. In certain cases, we
            may ask you to re-accept the updated policy before continuing to use the Platform. Your
            continued use of the Platform after changes are posted constitutes your acceptance of the
            revised policy.
          </p>
        </section>

        {/* Section 14 */}
        <section id="contact" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">14. How to Contact Us</h2>
          <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">Valisse Co LLC</strong>
            </p>
            <p>Email: <a href="mailto:info@valisseco.com" className="text-primary underline">info@valisseco.com</a></p>
            <p>Website: www.valisseco.com</p>
            <p className="pt-2 text-[11px]">
              We aim to respond to privacy-related inquiries within two (2) business days.
            </p>
          </div>
        </section>

        {/* Cross links */}
        <div className="border-t border-border pt-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex gap-4">
            <a href="/terms" className="text-primary hover:underline">
              Terms of Service
            </a>
            <a href="/support" className="text-primary hover:underline">
              Help &amp; Support
            </a>
          </div>
          <p className="text-muted-foreground">&copy; 2026 Valisse Co LLC. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}
