import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { buildLastMinuteBookingPath } from "@shared/lastMinuteBooking";
import { CalendarX, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";

export default function LastMinuteBookingRedirect() {
  const [, params] = useRoute("/book-last-minute/:slotId");
  const slotId = Number(params?.slotId ?? 0);
  const [, navigate] = useLocation();
  const slotQuery = trpc.lastMinute.activeSlot.useQuery(
    { slotId },
    { enabled: Number.isInteger(slotId) && slotId > 0 },
  );

  useEffect(() => {
    if (slotQuery.data) {
      navigate(buildLastMinuteBookingPath(slotQuery.data, "/notifications"));
    }
  }, [navigate, slotQuery.data]);

  if (slotQuery.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Opening the last-minute booking…</p>
      </div>
    );
  }

  if (!slotQuery.data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
          <CalendarX className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-serif font-semibold text-foreground">This opening is no longer available</h1>
          <p className="mt-1 text-sm text-muted-foreground">Browse other available appointments with this nail tech.</p>
        </div>
        <Button onClick={() => navigate("/discover")}>Browse nail looks</Button>
      </div>
    );
  }

  return null;
}
