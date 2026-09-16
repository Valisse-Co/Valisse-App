import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { completePaymentMethodSetup } from "../../../shared/paymentSetup";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function PaymentSetupForm({ bookingId, onComplete }: { bookingId: number; onComplete: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [elementError, setElementError] = useState<string | null>(null);
  const completeSetup = trpc.appointment.paymentSetupComplete.useMutation();

  const submit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      await completePaymentMethodSetup({
        confirm: () => stripe.confirmSetup({ elements, redirect: "if_required" }),
        save: async (setupIntentId) => {
          await completeSetup.mutateAsync({ bookingId, setupIntentId });
        },
      });
      onComplete();
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
        onLoadError={(event) => setElementError(event.error.message || "The secure card form could not load. Please refresh and try again.")}
      />
      {elementError && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">
          {elementError}
        </p>
      )}
      <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>Your card is securely saved for this appointment. You will not be charged now; Valisse charges only after your verified appointment is complete or when an applicable cancellation fee is due.</p>
      </div>
      <Button className="w-full" onClick={submit} disabled={!stripe || !elements || Boolean(elementError) || submitting || completeSetup.isPending}>
        {submitting || completeSetup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save payment method
      </Button>
    </div>
  );
}

export function BookingPaymentSetup({ bookingId, clientSecret, onComplete }: { bookingId: number; clientSecret: string; onComplete: () => void }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#008f62", borderRadius: "12px" } } }}>
      <PaymentSetupForm bookingId={bookingId} onComplete={onComplete} />
    </Elements>
  );
}
