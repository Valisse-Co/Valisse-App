import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { completePaymentMethodSetup } from "../../../shared/paymentSetup";

type StripeMode = "test" | "live";
type PaymentSetupComplete = (setupIntentId?: string) => void | Promise<void>;

const stripePromises: Record<StripeMode, ReturnType<typeof loadStripe>> = {
  test: loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY),
  live: loadStripe(import.meta.env.VITE_VALISSE_STRIPE_LIVE_PUBLISHABLE_KEY || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY),
};

function PaymentSetupForm({ bookingId, onComplete }: { bookingId?: number; onComplete: PaymentSetupComplete }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [elementReady, setElementReady] = useState(false);
  const [elementError, setElementError] = useState<string | null>(null);
  const completeSetup = trpc.appointment.paymentSetupComplete.useMutation();
  const canSubmit = Boolean(stripe && elements && elementReady && !elementError && !submitting && !completeSetup.isPending);

  const submit = async () => {
    if (!canSubmit || !stripe || !elements) return;
    setSubmitting(true);
    try {
      await completePaymentMethodSetup({
        confirm: () => stripe.confirmSetup({ elements, redirect: "if_required" }),
        save: async (setupIntentId) => {
          if (bookingId) {
            await completeSetup.mutateAsync({ bookingId, setupIntentId });
            await onComplete();
            return;
          }
          await onComplete(setupIntentId);
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We could not save this payment method.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{ layout: "tabs" }}
        onReady={() => setElementReady(true)}
        onLoadError={(event) => setElementError(event.error.message || "The secure card form could not load. Please refresh and try again.")}
      />
      {!elementReady && !elementError && <p className="text-center text-xs text-muted-foreground">Loading secure card form…</p>}
      {elementError && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">
          {elementError}
        </p>
      )}
      <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>Your card is securely saved for this appointment. You will not be charged now; Valisse charges only after your verified appointment is complete or when an applicable cancellation fee is due.</p>
      </div>
      <Button className="w-full" onClick={submit} disabled={!canSubmit}>
        {submitting || completeSetup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {submitting || completeSetup.isPending ? "Saving secure card…" : "Save payment method"}
      </Button>
    </div>
  );
}

export function BookingPaymentSetup({ bookingId, clientSecret, stripeMode = "live", onComplete }: { bookingId?: number; clientSecret: string; stripeMode?: StripeMode; onComplete: PaymentSetupComplete }) {
  return (
    <Elements stripe={stripePromises[stripeMode]} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#008f62", borderRadius: "12px" } } }}>
      <PaymentSetupForm bookingId={bookingId} onComplete={onComplete} />
    </Elements>
  );
}
