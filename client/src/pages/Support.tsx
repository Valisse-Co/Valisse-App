import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Mail,
  Clock,
  Send,
  CheckCircle2,
  HelpCircle,
  FileText,
  Shield,
  Share2,
  ExternalLink,
  ChevronRight,
  MessageCircleQuestion,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AppFooter from "@/components/AppFooter";

type Category =
  | "booking"
  | "payment"
  | "subscription"
  | "account"
  | "safety"
  | "feedback"
  | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "booking", label: "Booking & appointments" },
  { value: "payment", label: "Payments, fees & refunds" },
  { value: "subscription", label: "Nail tech subscriptions & payouts" },
  { value: "account", label: "Account, sign-in & security" },
  { value: "safety", label: "Safety, reporting & trust concerns" },
  { value: "feedback", label: "Feedback & feature requests" },
  { value: "other", label: "Other / general question" },
];

const FAQS = [
  {
    q: "How do I cancel or reschedule an appointment?",
    a: "Open Bookings from the bottom navigation, tap the appointment you want to change, and choose Cancel. Cancellation windows and any applicable fees are set by each independent technician, so be sure to review the technician’s policy shown on their profile and in your confirmation. If you need to reschedule, we recommend messaging your technician first in the Messages tab.",
  },
  {
    q: "How do refunds work?",
    a: "All payments are generally non-refundable unless required by applicable law or provided by the technician’s individual cancellation policy. If a technician cancels an appointment they cannot honor, the prepaid amount is refunded. For payment disputes, message your technician first or submit a request through the form on this page and our team will help facilitate a resolution.",
  },
  {
    q: "How do nail tech subscriptions and trials work?",
    a: "New nail technicians receive a free trial (one free month, plus an additional free month once you reach 50 followers). After the trial, you can continue on paid plans such as Pro ($29/month) or Pro Annual ($249/year). Subscriptions renew automatically and can be cancelled any time from Settings > Subscription before the renewal date.",
  },
  {
    q: "When and how do nail techs get paid?",
    a: "Completed appointment earnings are released to your connected Stripe account after service completion, subject to any dispute hold periods and Stripe’s payout schedule (typically rolling every 2 business days). Manage your payout account anytime in Settings > Payouts.",
  },
  {
    q: "How do I turn off SMS notifications?",
    a: "Reply STOP to any text message from Valisse to immediately opt out of SMS. You can also adjust your notification channels anytime in Settings > Notifications.",
  },
  {
    q: "How do I delete or deactivate my account?",
    a: "Go to Settings > Account & Security. You can temporarily deactivate your account (your profile will be hidden until you sign in again) or permanently delete it. Account deletion removes your personal data within a reasonable time, except where retention is required by law.",
  },
  {
    q: "How do I report a problem, fake content, or unsafe behavior?",
    a: "Use the report option on any post (the flag icon) to flag inappropriate content. For user or safety concerns, select “Safety, reporting & trust concerns” in the contact form below or email us directly at info@valisseco.com.",
  },
  {
    q: "How can I contact the Valisse team?",
    a: "The fastest way is the contact form on this page — we create a trackable ticket and confirm it by email. You can also email us directly at info@valisseco.com. We reply within 24–48 hours, Monday–Friday.",
  },
];

export default function Support() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<Category>("booking");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [appointmentRef, setAppointmentRef] = useState("");
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);

  useEffect(() => {
    if (user?.name && !name) setName(user.name);
    if (user?.email && !email) setEmail(user.email);
  }, [user]);

  const submitTicket = trpc.support.submitTicket.useMutation({
    onSuccess: (data) => {
      setSubmittedTicket(data.ticketNumber);
      toast.success("Your request has been received.");
    },
    onError: (err) => {
      toast.error(err.message || "Could not send your request. Please try again or email us.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Please enter your name.");
    if (!email.trim() || !email.includes("@")) return toast.error("Please enter a valid email address.");
    if (!subject.trim()) return toast.error("Please enter a subject.");
    if (message.trim().length < 5) return toast.error("Please add a little more detail to your message.");
    submitTicket.mutate({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      category,
      subject: subject.trim(),
      message: message.trim(),
      appointmentRef: appointmentRef.trim() || undefined,
    });
  };

  const handleResetForm = () => {
    setSubmittedTicket(null);
    setSubject("");
    setMessage("");
    setAppointmentRef("");
    setCategory("booking");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Valisse — Book the Look You Love",
          text: "Discover and book talented independent nail artists near you on Valisse.",
          url: "https://www.valisseco.com",
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText("https://www.valisseco.com");
      toast.success("Link copied to clipboard");
    }
  };

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
            <HelpCircle size={20} className="text-primary" />
            <h1 className="font-semibold text-foreground text-base">Help &amp; Support</h1>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8 text-foreground">
        {/* Hero banner */}
        <section className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">
            Support Center
          </p>
          <h2 className="font-display text-3xl font-light text-foreground">
            How can we help?
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Find answers to common questions or send us a message. We’re here to make every
            booking smooth.
          </p>
        </section>

        {/* Contact channels card */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Mail size={14} className="text-primary" />
            <span>Direct contact</span>
          </div>
          <div className="space-y-1 text-sm">
            <p>
              <strong className="text-foreground">Email:</strong>{" "}
              <a
                href="mailto:info@valisseco.com?subject=Valisse%20Support%20Request"
                className="text-primary underline underline-offset-2"
              >
                info@valisseco.com
              </a>
            </p>
            <p className="text-xs text-muted-foreground">
              Response time: we typically reply within 24–48 hours, Monday–Friday
            </p>
            <p className="text-xs text-muted-foreground">
              Company: Valisse Co LLC · www.valisseco.com
            </p>
          </div>
          <div className="pt-2 flex flex-wrap gap-2 text-xs">
            <a
              href="mailto:info@valisseco.com?subject=Valisse%20Support%20Request"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
            >
              <Mail size={13} /> Open email app
            </a>
            <a
              href="/privacy"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <Shield size={13} /> Privacy Policy
            </a>
            <a
              href="/terms"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText size={13} /> Terms of Service
            </a>
          </div>
        </section>

        {/* Interactive contact form */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Send size={14} className="text-primary" />
            <span>Send us a message</span>
          </div>

          {submittedTicket ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center space-y-3">
              <CheckCircle2 size={36} className="text-primary mx-auto" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Thanks! We’ve received your request.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Reference number:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {submittedTicket}
                  </span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Our support team will get back to you at{" "}
                <span className="font-semibold text-foreground">{email}</span> within 24–48 hours,
                Monday–Friday.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetForm}
                className="text-xs"
              >
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="support-name" className="text-xs">
                    Your name <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="support-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="support-email" className="text-xs">
                    Your email <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="support-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Topic <span className="text-primary">*</span>
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v as Category)}
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Choose a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value} className="text-xs">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="support-ref" className="text-xs">
                    Appointment / reference # <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="support-ref"
                    value={appointmentRef}
                    onChange={(e) => setAppointmentRef(e.target.value)}
                    placeholder="e.g. #12345"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="support-subject" className="text-xs">
                  Subject <span className="text-primary">*</span>
                </Label>
                <Input
                  id="support-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="A short summary of your issue"
                  maxLength={255}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="support-message" className="text-xs">
                    Message <span className="text-primary">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {message.length} / 5000
                  </span>
                </div>
                <Textarea
                  id="support-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what happened in detail, including dates and technician names if relevant…"
                  rows={5}
                  maxLength={5000}
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <Button
                  type="submit"
                  disabled={submitTicket.isPending}
                  className="w-full sm:w-auto px-6 h-11 text-xs font-semibold gap-2"
                >
                  <Send size={14} />
                  {submitTicket.isPending ? "Sending…" : "Send message"}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  By sending, you agree to our{" "}
                  <a href="/privacy" className="text-primary underline">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </form>
          )}
        </section>

        {/* FAQ */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <MessageCircleQuestion size={14} className="text-primary" />
            <span>Frequently asked questions</span>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-2">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="rounded-2xl border border-border bg-card px-4 border-b-0"
              >
                <AccordionTrigger className="text-sm font-medium text-left hover:no-underline py-4 text-foreground">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Community & legal links */}
        <section className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          <a
            href="/terms"
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
          >
            <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <FileText size={18} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-foreground">Terms of Service</span>
              <span className="block text-xs text-muted-foreground truncate">
                Our user agreement and marketplace rules
              </span>
            </span>
            <ChevronRight size={18} className="text-muted-foreground" />
          </a>
          <a
            href="/privacy"
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
          >
            <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Shield size={18} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-foreground">Privacy Policy</span>
              <span className="block text-xs text-muted-foreground truncate">
                How we collect, use, and protect your data
              </span>
            </span>
            <ChevronRight size={18} className="text-muted-foreground" />
          </a>
          <button
            type="button"
            onClick={handleShare}
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
          >
            <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Share2 size={18} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-foreground">Share Valisse</span>
              <span className="block text-xs text-muted-foreground truncate">
                Invite friends to find independent nail artists
              </span>
            </span>
            <ChevronRight size={18} className="text-muted-foreground" />
          </button>
        </section>

        {/* Footer */}
        <AppFooter />
      </main>
    </div>
  );
}
