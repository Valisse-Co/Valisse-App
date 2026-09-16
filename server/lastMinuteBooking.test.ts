import { describe, expect, it } from "vitest";
import {
  buildLastMinuteBookingPath,
  fitsWithinAvailabilityWindows,
  mergeAvailabilityWindows,
  timeToMinutes,
} from "../shared/lastMinuteBooking";

describe("last-minute booking helpers", () => {
  it("routes an opening into the normal booking flow with preferred-slot context", () => {
    expect(buildLastMinuteBookingPath({
      id: 42,
      techId: 90044,
      slotDate: "2026-09-15",
      startTime: "21:30",
      endTime: "23:00",
    }, "/discover")).toBe(
      "/book/90044?lastMinuteSlotId=42&lastMinuteDate=2026-09-15&lastMinuteStart=21%3A30&lastMinuteEnd=23%3A00&from=%2Fdiscover",
    );
  });

  it("allows a combined appointment to span adjacent regular and last-minute availability", () => {
    const windows = mergeAvailabilityWindows([
      { start: timeToMinutes("09:00"), end: timeToMinutes("22:00") },
      { start: timeToMinutes("22:00"), end: timeToMinutes("23:00") },
    ]);

    expect(windows).toEqual([{ start: 540, end: 1380 }]);
    expect(fitsWithinAvailabilityWindows(timeToMinutes("21:30"), 90, windows)).toBe(true);
    expect(fitsWithinAvailabilityWindows(timeToMinutes("22:00"), 60, windows)).toBe(true);
    expect(fitsWithinAvailabilityWindows(timeToMinutes("22:15"), 90, windows)).toBe(false);
  });

  it("does not treat gaps between regular and last-minute windows as bookable", () => {
    const windows = mergeAvailabilityWindows([
      { start: timeToMinutes("09:00"), end: timeToMinutes("17:00") },
      { start: timeToMinutes("18:00"), end: timeToMinutes("19:00") },
    ]);

    expect(fitsWithinAvailabilityWindows(timeToMinutes("16:30"), 90, windows)).toBe(false);
  });
});
