import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Shield, MessageSquare, FileText, ChevronRight } from "lucide-react";

interface ConsentStepProps {
  onComplete: () => void;
}

export default function ConsentStep({ onComplete }: ConsentStepProps) {
  const [, navigate] = useLocation();
  const [tosChecked, setTosChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [smsChecked, setSmsChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const acceptConsents = trpc.users.acceptConsents.useMutation();

  const canProceed = tosChecked && privacyChecked;

  async function handleSubmit() {
    if (!canProceed) return;
    setSubmitting(true);
    try {
      await acceptConsents.mutateAsync({ smsConsent: smsChecked });
      onComplete();
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Shield size={24} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Before you continue</h1>
        <p className="text-sm text-muted-foreground">
          Please review and accept our terms to start using Valisse.
        </p>
      </div>

      {/* Consent items */}
      <div className="flex flex-col gap-4 flex-1">
        {/* ToS */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="tos"
              checked={tosChecked}
              onCheckedChange={(v) => setTosChecked(!!v)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <label htmlFor="tos" className="text-sm font-medium text-foreground cursor-pointer">
                I agree to the{" "}
                <button
                  type="button"
                  onClick={() => navigate("/terms")}
                  className="text-primary underline underline-offset-2 font-semibold"
                >
                  Terms of Service
                </button>
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Required to use Valisse
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/terms")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Privacy Policy */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="privacy"
              checked={privacyChecked}
              onCheckedChange={(v) => setPrivacyChecked(!!v)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <label htmlFor="privacy" className="text-sm font-medium text-foreground cursor-pointer">
                I agree to the{" "}
                <button
                  type="button"
                  onClick={() => navigate("/privacy")}
                  className="text-primary underline underline-offset-2 font-semibold"
                >
                  Privacy Policy
                </button>
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Required to use Valisse
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/privacy")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* SMS Consent */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="sms"
              checked={smsChecked}
              onCheckedChange={(v) => setSmsChecked(!!v)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <MessageSquare size={14} className="text-muted-foreground" />
                <label htmlFor="sms" className="text-sm font-medium text-foreground cursor-pointer">
                  SMS Notifications
                </label>
                <span className="text-xs text-muted-foreground">(Optional)</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                I agree to receive text messages from Valisse for booking reminders and updates.
                Message and data rates may apply. You can opt out at any time.
              </p>
            </div>
          </div>
        </div>

        {/* Legal note */}
        <div className="flex items-start gap-2 px-1">
          <FileText size={13} className="text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            By continuing, you confirm you are at least 18 years old and agree to be bound by these agreements. If we update our Terms, you will be asked to re-accept before continuing.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8">
        <Button
          className="w-full h-12 text-base font-semibold"
          disabled={!canProceed || submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Saving…" : "Continue"}
        </Button>
        {!canProceed && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Please accept the Terms of Service and Privacy Policy to continue.
          </p>
        )}
      </div>
    </div>
  );
}
