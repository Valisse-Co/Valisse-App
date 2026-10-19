export type ShareableAvailabilityWindow = {
  localDate: string;
  startTime: string;
  endTime: string;
  audience: "open" | "returning_only";
};

export type AvailableStartSlot = {
  time: string;
  available: boolean;
  reason?: string;
  audience: "open" | "returning_only";
};

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const remainder = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${remainder}`;
}

/**
 * Turns a single day's bookable 15-minute starts into truthful time windows.
 * A new window begins at any gap or audience restriction change.
 */
export function groupAvailableStartsIntoWindows(
  localDate: string,
  slots: AvailableStartSlot[],
  intervalMinutes = 15,
): ShareableAvailabilityWindow[] {
  const sorted = slots
    .filter((slot) => slot.available)
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  const windows: ShareableAvailabilityWindow[] = [];

  for (const slot of sorted) {
    const previous = windows[windows.length - 1];
    const slotMinutes = toMinutes(slot.time);
    if (
      previous
      && previous.audience === slot.audience
      && toMinutes(previous.endTime) === slotMinutes
    ) {
      previous.endTime = toTime(slotMinutes + intervalMinutes);
    } else {
      windows.push({
        localDate,
        startTime: slot.time,
        endTime: toTime(slotMinutes + intervalMinutes),
        audience: slot.audience,
      });
    }
  }

  return windows;
}

export function availabilityAudienceLabel(audience: "open" | "returning_only") {
  return audience === "returning_only" ? "Returning clients only" : "Open to everyone";
}

export function buildAvailabilityOfferPath(token: string) {
  return `/book-availability/${encodeURIComponent(token)}`;
}

export function buildAvailabilityOfferFallbackPath(techId: number) {
  return `/book/${techId}?from=availability-message`;
}
