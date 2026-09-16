export type AvailabilityWindow = {
  start: number;
  end: number;
};

export type LastMinuteBookingSlot = {
  id: number;
  techId: number;
  slotDate: string;
  startTime: string;
  endTime: string;
};

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function mergeAvailabilityWindows(windows: AvailabilityWindow[]): AvailabilityWindow[] {
  const sorted = [...windows]
    .filter((window) => Number.isFinite(window.start) && Number.isFinite(window.end) && window.end > window.start)
    .sort((a, b) => a.start - b.start);

  return sorted.reduce<AvailabilityWindow[]>((merged, window) => {
    const previous = merged[merged.length - 1];
    if (previous && window.start <= previous.end) {
      previous.end = Math.max(previous.end, window.end);
    } else {
      merged.push({ ...window });
    }
    return merged;
  }, []);
}

export function fitsWithinAvailabilityWindows(start: number, durationMinutes: number, windows: AvailabilityWindow[]): boolean {
  const end = start + durationMinutes;
  return windows.some((window) => start >= window.start && end <= window.end);
}

export function buildLastMinuteBookingPath(slot: LastMinuteBookingSlot, from?: string): string {
  const params = new URLSearchParams({
    lastMinuteSlotId: String(slot.id),
    lastMinuteDate: slot.slotDate,
    lastMinuteStart: slot.startTime,
    lastMinuteEnd: slot.endTime,
  });
  if (from) params.set("from", from);
  return `/book/${slot.techId}?${params.toString()}`;
}
