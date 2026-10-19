import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CalendarX, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";

export default function AvailabilityOfferBookingRedirect() {
  const [, params] = useRoute("/book-availability/:token");
  const token = params?.token ?? "";
  const [, navigate] = useLocation();
  const offerQuery = trpc.messaging.resolveAvailabilityOfferWindow.useQuery(
    { token },
    { enabled: token.length > 0, retry: false },
  );

  useEffect(() => {
    if (!offerQuery.data || offerQuery.data.state !== "available") return;
    const query = new URLSearchParams({
      availabilityOffer: token,
      preferredDate: offerQuery.data.localDate,
      preferredStart: offerQuery.data.startTime,
      preferredEnd: offerQuery.data.endTime,
      from: "availability-message",
    });
    navigate(`/book/${offerQuery.data.techId}?${query.toString()}`);
  }, [navigate, offerQuery.data, token]);

  if (offerQuery.isLoading) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Checking this opening…</p></div>;
  }

  const fallbackHref = offerQuery.data?.fallbackHref ?? "/discover";
  if (!offerQuery.data || offerQuery.data.state === "unavailable") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted"><CalendarX className="h-6 w-6 text-muted-foreground" /></div>
        <div><h1 className="text-xl font-serif font-semibold text-foreground">This time is no longer available</h1><p className="mt-1 text-sm text-muted-foreground">See this nail tech’s current openings instead.</p></div>
        <Button onClick={() => navigate(fallbackHref)}>View all availability</Button>
      </div>
    );
  }

  return null;
}
