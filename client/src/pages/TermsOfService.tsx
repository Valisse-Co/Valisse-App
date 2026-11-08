import { useLocation } from "wouter";
import { ArrowLeft, FileText, Printer } from "lucide-react";

export default function TermsOfService() {
  const [, navigate] = useLocation();

  const sections = [
    { id: "agreement", title: "1. Agreement to Terms" },
    { id: "platform", title: "2. Description of the Platform" },
    { id: "marketplace", title: "3. Marketplace Disclaimer" },
    { id: "accounts", title: "4. Eligibility & Accounts" },
    { id: "bookings", title: "5. Bookings & Appointments" },
    { id: "payments", title: "6. Pricing, Fees & Payments" },
    { id: "cancellations", title: "7. Cancellations, No-Shows & Refunds" },
    { id: "sms", title: "8. Messaging & SMS Communications" },
    { id: "content", title: "9. User Content & Licenses" },
    { id: "reviews", title: "10. Reviews & Ratings" },
    { id: "conduct", title: "11. Prohibited Conduct" },
    { id: "ip", title: "12. Intellectual Property" },
    { id: "disclaimer", title: "13. Disclaimer of Warranties" },
    { id: "liability", title: "14. Limitation of Liability" },
    { id: "indemnity", title: "15. Indemnification" },
    { id: "arbitration", title: "16. Dispute Resolution & Arbitration" },
    { id: "governing", title: "17. Governing Law" },
    { id: "modifications", title: "18. Modifications to Terms" },
    { id: "severability", title: "19. Severability & Entire Agreement" },
    { id: "contact", title: "20. Contact Information" },
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
            <FileText size={20} className="text-primary" />
            <h1 className="font-semibold text-foreground text-base">Terms of Service</h1>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          aria-label="Print terms"
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
            Please read these Terms of Service carefully before using Valisse. They include a
            binding arbitration clause and class action waiver that affect how disputes are resolved.
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
        <section id="agreement" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">1. Agreement to Terms</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            These Terms of Service (&ldquo;Terms&rdquo;) are a legally binding agreement between you and
            Valisse Co LLC (&ldquo;Valisse,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
            governing your access to and use of the Valisse website, mobile application, and related
            services (the &ldquo;Platform&rdquo;).
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By creating an account, browsing the Platform, or booking an appointment, you agree to
            be bound by these Terms and our Privacy Policy. If you do not agree, you may not use the
            Platform.
          </p>
        </section>

        {/* Section 2 */}
        <section id="platform" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">2. Description of the Platform</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Valisse operates an online marketplace that connects beauty clients (&ldquo;Clients&rdquo;)
            with independent nail technicians and beauty service professionals (&ldquo;Nail Techs&rdquo;
            or &ldquo;Technicians&rdquo;) for discovery, scheduling, messaging, and payment of nail and
            beauty services. Valisse provides the technology platform only. Valisse is not an
            employer, salon, staffing agency, or service provider of nail or beauty services.
          </p>
        </section>

        {/* Section 3 */}
        <section id="marketplace" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">3. Marketplace &amp; Independent Contractor Disclaimer</h2>
          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Independent contractors:</strong> Nail Techs listed on
              Valisse are independent business owners and contractors, not employees, partners, or
              agents of Valisse. Each Technician is solely responsible for their services, pricing,
              scheduling, sanitary and safety practices, licensing, insurance, and compliance with
              applicable laws and cosmetology regulations.
            </p>
            <p>
              <strong className="text-foreground">No control over services:</strong> Valisse does not
              control, supervise, or guarantee the quality, safety, outcome, or suitability of any
              service booked through the Platform. Valisse does not verify the credentials, insurance,
              or health/sanitation practices of every Technician.
            </p>
            <p>
              <strong className="text-foreground">Assumption of risk:</strong> You use the Platform and
              receive services at your own risk. To the fullest extent permitted by law, Valisse Co LLC
              is not liable for any injury, allergic reaction, infection, dissatisfaction, property
              damage, no-show, cancellation, or dispute arising between Clients and Technicians.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section id="accounts" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">4. Eligibility &amp; User Accounts</h2>
          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Age requirement:</strong> You must be at least 18 years
              old and legally capable of entering a binding contract to use the Platform. By using
              Valisse, you represent and warrant that you meet this requirement.
            </p>
            <p>
              <strong className="text-foreground">Account information:</strong> You agree to provide
              accurate, current, and complete information and to keep your credentials confidential. You
              are responsible for all activity under your account. You must notify us immediately at{" "}
              <a href="mailto:info@valisseco.com" className="text-primary underline">info@valisseco.com</a>{" "}
              of any unauthorized use.
            </p>
            <p>
              <strong className="text-foreground">Termination:</strong> We may suspend or terminate your
              account at our discretion, without prior notice, if you violate these Terms, engage in
              fraudulent or abusive conduct, or if we determine termination is necessary to protect the
              Platform or our users. You may deactivate or delete your account at any time through your
              account settings.
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section id="bookings" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">5. Bookings &amp; Appointments</h2>
          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Booking process:</strong> Bookings are made through the
              Platform. A booking is considered confirmed once the Technician confirms it (or it is
              auto-confirmed) and the Client completes any required payment authorization. Confirmations
              and appointment codes are issued through the Platform and by SMS/email where consented.
            </p>
            <p>
              <strong className="text-foreground">Client responsibilities:</strong> Clients must arrive on
              time, provide accurate service requirements, disclose any relevant health conditions or
              allergies to the Technician, and pay the agreed amount. Clients are responsible for
              following the Technician&rsquo;s aftercare guidance.
            </p>
            <p>
              <strong className="text-foreground">Technician responsibilities:</strong> Technicians must
              honor confirmed appointments, keep availability and pricing accurate, communicate
              promptly about schedule changes, maintain required licenses and sanitation standards, and
              treat Clients professionally.
            </p>
          </div>
        </section>

        {/* Section 6 */}
        <section id="payments" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">6. Pricing, Fees &amp; Payments</h2>
          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Service pricing:</strong> Each Nail Tech sets their own
              prices and service menus. Prices shown include the Technician&rsquo;s stated service fee.
              Applicable taxes, fees, and tips (where offered) are displayed before confirmation.
            </p>
            <p>
              <strong className="text-foreground">Payment processing:</strong> In-app payments are
              processed by Stripe. By saving a payment method, you authorize Valisse (via Stripe) to
              charge that method for confirmed bookings, subscriptions, tips, and authorized
              cancellation/no-show fees. Payments between users arranged outside the Platform are not
              tracked, protected, or resolved by Valisse.
            </p>
            <p>
              <strong className="text-foreground">Nail Tech subscriptions:</strong> Nail Techs may be
              offered a free trial (for example, one free month, plus an additional free month when
              reaching 50 followers), followed by paid subscription plans such as $29/month Pro or
              $249/year Pro Annual. Subscriptions renew automatically unless cancelled before the renewal
              date through Settings &gt; Subscription. Promotional credits and trial periods are subject
              to change at our discretion.
            </p>
            <p>
              <strong className="text-foreground">Payouts:</strong> Eligible appointment payouts to
              Technicians are released to their connected Stripe account after service completion,
              subject to any applicable dispute hold periods, fee deductions, and Stripe&rsquo;s payout
              schedule.
            </p>
          </div>
        </section>

        {/* Section 7 */}
        <section id="cancellations" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">7. Cancellations, No-Shows &amp; Refunds</h2>
          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Cancellation policies are set by each Technician:</strong>{" "}
              Each Nail Tech may define their own cancellation window and fee structure (flat amount or
              percentage). Clients must review the Technician&rsquo;s posted policy before booking. A free
              grace period may apply for cancellations made shortly after booking.
            </p>
            <p>
              <strong className="text-foreground">No-shows:</strong> Technicians may charge a posted no-show
              fee for appointments where a Client fails to appear without notice. Clients who arrive
              late may receive an adjusted service at the full booked price.
            </p>
            <p>
              <strong className="text-foreground">General refund policy:</strong> All payments are
              non-refundable except as expressly required by applicable law or as provided by the
              Technician&rsquo;s individual policy. If a Technician cancels an appointment they cannot
              honor, any prepaid amount will be refunded. Valisse is not responsible for refund disputes
              between users but may facilitate communication and, where appropriate, issue discretionary
              resolutions.
            </p>
          </div>
        </section>

        {/* Section 8 */}
        <section id="sms" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">8. Messaging &amp; SMS Communications</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            By opting in, you consent to receive transactional text messages from Valisse related to
            your appointments. You may opt out at any time by replying <span className="font-semibold text-foreground">STOP</span>,
            updating notification preferences, or emailing <a href="mailto:info@valisseco.com" className="text-primary underline">info@valisseco.com</a>.
            Reply HELP for help. Message and data rates may apply.
          </p>
        </section>

        {/* Section 9 */}
        <section id="content" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">9. User Content &amp; Licenses</h2>
          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Your content:</strong> You retain ownership of photos,
              reviews, captions, and other content you post. By posting content on Valisse, you grant
              Valisse a worldwide, non-exclusive, royalty-free, transferable license to host, display,
              reproduce, and distribute that content in connection with operating and promoting the
              Platform.
            </p>
            <p>
              <strong className="text-foreground">Content standards:</strong> You represent that you own
              or have the rights to post all content you submit. You may not post stolen, infringing,
              nude, sexually explicit, violent, harassing, hateful, or unlawful content.
            </p>
            <p>
              <strong className="text-foreground">Moderation:</strong> We reserve the right to remove or
              hide any content that violates these Terms or that we determine is otherwise inappropriate,
              and to suspend accounts of repeat violators. Users may report content through the in-app
              reporting tool.
            </p>
          </div>
        </section>

        {/* Section 10 */}
        <section id="reviews" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">10. Reviews &amp; Ratings</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Reviews must reflect genuine, first-hand service experiences. You may only review
            appointments you personally completed. Fake, coerced, compensated, retaliatory, or abusive
            reviews are prohibited and will be removed. We may restrict review privileges for accounts
            that abuse this feature.
          </p>
        </section>

        {/* Section 11 */}
        <section id="conduct" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">11. Prohibited Conduct</h2>
          <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground leading-relaxed">
            <li>Violate any applicable federal, state, local, or cosmetology law or regulation</li>
            <li>Misrepresent your identity, license status, business, or services</li>
            <li>Harass, threaten, stalk, or discriminate against other users</li>
            <li>Post fake or manipulated reviews, ratings, or bookings</li>
            <li>Scrape, crawl, harvest, or bulk-download Platform data without permission</li>
            <li>Attempt to probe, scan, or breach Platform security, or interfere with Platform operation</li>
            <li>Circumvent subscription or fee mechanisms, or use stolen payment instruments</li>
            <li>Engage in off-platform payment schemes that deceive other users</li>
          </ul>
        </section>

        {/* Section 12 */}
        <section id="ip" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">12. Intellectual Property</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Valisse name, logo, trade dress, website design, software, and all related trademarks
            and copyrights are the property of Valisse Co LLC and its licensors. You may not copy,
            modify, or create derivative works of any Valisse intellectual property without prior
            written consent.
          </p>
        </section>

        {/* Section 13 */}
        <section id="disclaimer" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">13. Disclaimer of Warranties</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            THE PLATFORM IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS, WITHOUT
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES
            OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. VALISSE DOES NOT
            WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR TIMELY, NOR DOES IT
            WARRANT THE ACCURACY, RELIABILITY, OR QUALITY OF ANY CONTENT, TECHNICIAN, OR SERVICE OBTAINED
            THROUGH THE PLATFORM.
          </p>
        </section>

        {/* Section 14 */}
        <section id="liability" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">14. Limitation of Liability</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL VALISSE CO LLC, ITS
            OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES &mdash; INCLUDING LOST PROFITS, DATA LOSS, PERSONAL INJURY,
            PROPERTY DAMAGE, OR SERVICE DISSATISFACTION &mdash; ARISING OUT OF OR IN CONNECTION WITH YOUR
            USE OF THE PLATFORM OR ANY SERVICE BOOKED THROUGH IT, REGARDLESS OF THE LEGAL THEORY. OUR
            AGGREGATE LIABILITY FOR ALL CLAIMS UNDER THESE TERMS SHALL NOT EXCEED THE GREATER OF (A) THE
            AMOUNTS YOU PAID TO VALISSE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM OR (B) ONE HUNDRED
            U.S. DOLLARS ($100).
          </p>
        </section>

        {/* Section 15 */}
        <section id="indemnity" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">15. Indemnification</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You agree to defend, indemnify, and hold harmless Valisse Co LLC and its affiliates,
            officers, directors, employees, and agents from and against any claims, damages, losses,
            liabilities, costs, and expenses (including reasonable attorneys&rsquo; fees) arising out of or
            related to your use of the Platform, your content, your violation of these Terms, or any
            dispute between you and another user.
          </p>
        </section>

        {/* Section 16 */}
        <section id="arbitration" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">16. Dispute Resolution, Binding Arbitration &amp; Class Action Waiver</h2>
          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Informal resolution first:</strong> Before filing any
              claim, you agree to contact us at{" "}
              <a href="mailto:info@valisseco.com?subject=Dispute" className="text-primary underline">info@valisseco.com</a>{" "}
              and attempt to resolve the dispute informally for at least thirty (30) days.
            </p>
            <p>
              <strong className="text-foreground">Binding individual arbitration:</strong> Any dispute,
              claim, or controversy arising out of or relating to these Terms or the Platform that is
              not resolved informally shall be resolved by final and binding individual arbitration
              administered by the American Arbitration Association (AAA) under its Consumer Arbitration
              Rules, rather than in court. The arbitrator&rsquo;s decision is final and enforceable in any
              court of competent jurisdiction.
            </p>
            <p>
              <strong className="text-foreground">Class action waiver:</strong> YOU AND VALISSE AGREE THAT
              ANY CLAIM MUST BE BROUGHT IN AN INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER
              IN ANY PURPORTED CLASS, CONSOLIDATED, OR REPRESENTATIVE PROCEEDING.
            </p>
            <p>
              <strong className="text-foreground">Exceptions:</strong> Either party may seek injunctive or
              other equitable relief in a court of competent jurisdiction to protect intellectual
              property rights, and individual claims may be brought in small claims court where
              appropriate.
            </p>
          </div>
        </section>

        {/* Section 17 */}
        <section id="governing" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">17. Governing Law</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These Terms and any dispute arising from them shall be governed by and construed in
            accordance with the laws of the State of Delaware, United States, without giving effect to
            any conflict-of-law principles.
          </p>
        </section>

        {/* Section 18 */}
        <section id="modifications" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">18. Modifications to Terms</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update these Terms from time to time. When we make material changes, we will update the
            &ldquo;Effective Date&rdquo; and provide notice through the Platform or by email. Where
            appropriate, we will ask you to re-accept the updated Terms before continuing. Your
            continued use of the Platform after changes take effect constitutes your acceptance of the
            updated Terms.
          </p>
        </section>

        {/* Section 19 */}
        <section id="severability" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">19. Severability &amp; Entire Agreement</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If any provision of these Terms is found to be invalid or unenforceable, the remaining
            provisions will continue in full force and effect. These Terms, together with our Privacy
            Policy and any posted policies incorporated by reference, constitute the entire agreement
            between you and Valisse regarding the Platform.
          </p>
        </section>

        {/* Section 20 */}
        <section id="contact" className="mb-8 scroll-mt-16">
          <h2 className="text-lg font-semibold mb-2">20. Contact Information</h2>
          <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">Valisse Co LLC</strong>
            </p>
            <p>Email: <a href="mailto:info@valisseco.com" className="text-primary underline">info@valisseco.com</a></p>
            <p>Website: www.valisseco.com</p>
            <p className="pt-2 text-[11px]">
              For questions about these Terms, support requests, or dispute notices, please contact us
              at the email above.
            </p>
          </div>
        </section>

        {/* Cross links */}
        <div className="border-t border-border pt-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex gap-4">
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
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
