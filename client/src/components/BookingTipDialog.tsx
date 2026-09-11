import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function TipPaymentForm({ bookingId, paymentIntentId, onComplete }: { bookingId: number; paymentIntentId: string; onComplete: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const complete = trpc.appointment.tipComplete.useMutation();

  const submit = async () => {
    if (!stripe || !elements) return;
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (error || !paymentIntent) return toast.error(error?.message ?? "Your tip could not be processed.");
    try {
      await complete.mutateAsync({ bookingId, paymentIntentId });
      toast.success("Thank you—your tip will go entirely to your nail tech.");
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Your tip was processed but could not be recorded yet.");
    }
  };

  return <div className="space-y-4"><PaymentElement options={{ layout: "tabs" }} /><Button className="w-full" disabled={!stripe || !elements || complete.isPending} onClick={submit}>{complete.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Send tip</Button></div>;
}

export function BookingTipDialog({ bookingId, clientSecret, paymentIntentId, onComplete }: { bookingId: number; clientSecret: string; paymentIntentId: string; onComplete: () => void }) {
  return <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#008f62", borderRadius: "12px" } } }}><TipPaymentForm bookingId={bookingId} paymentIntentId={paymentIntentId} onComplete={onComplete} /></Elements>;
}
