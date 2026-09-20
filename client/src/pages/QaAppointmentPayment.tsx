import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookingPaymentSetup } from "@/components/BookingPaymentSetup";
import { QaAppointmentBanner } from "@/components/QaAppointmentBanner";
import { trpc } from "@/lib/trpc";
import { CreditCard, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function QaAppointmentPayment() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const current = trpc.qaAppointment.current.useQuery(undefined);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const booking = current.data?.booking as any;
  const beginSetup = trpc.appointment.paymentSetup.useMutation({
    onSuccess: ({ clientSecret: nextSecret }) => setClientSecret(nextSecret),
    onError: (error) => toast.error(error.message || "Could not prepare secure card setup."),
  });

  if (current.isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }
  if (!current.data?.run || current.data.canManage || !booking?.isQaTest) {
    return <div className="min-h-screen bg-background p-6"><p className="mx-auto max-w-md pt-16 text-center text-sm text-muted-foreground">This secure card screen is available only to the disposable client in an active QA appointment run.</p></div>;
  }
  if (booking.paymentMethodStatus === "saved") {
    return <div className="min-h-screen bg-background px-6 py-12"><div className="mx-auto max-w-md space-y-4"><QaAppointmentBanner /><Card className="rounded-2xl p-5 text-center"><ShieldCheck className="mx-auto text-primary" size={30} /><h1 className="mt-3 text-lg font-semibold text-foreground">Test card saved</h1><p className="mt-2 text-sm text-muted-foreground">Return to the QA Appointment Lab and confirm the appointment as the technician.</p><Button className="mt-5 w-full" onClick={() => navigate("/bookings?qaRun=1")}>View test appointment</Button></Card></div></div>;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-md space-y-4"><QaAppointmentBanner /><div className="text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><CreditCard size={23} /></div><h1 className="mt-3 text-xl font-semibold text-foreground">Save a QA test card</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">This is the same client-authorized card-save step used in booking. It stores a Stripe test card only and does not charge it now.</p></div><Card className="rounded-2xl p-5">{clientSecret ? <BookingPaymentSetup bookingId={booking.id} clientSecret={clientSecret} onComplete={() => { utils.qaAppointment.current.invalidate(); utils.bookings.clientBookings.invalidate(); navigate("/bookings?qaRun=1"); }} /> : <div className="space-y-4 text-center"><p className="text-xs leading-relaxed text-muted-foreground">Use 4242 4242 4242 4242 with any future date, CVC, and ZIP for a successful Stripe test-mode setup.</p><Button className="w-full" onClick={() => beginSetup.mutate({ bookingId: booking.id })} disabled={beginSetup.isPending}>{beginSetup.isPending ? "Preparing secure card form…" : "Continue to secure card setup"}</Button></div>}</Card></div>
    </div>
  );
}
