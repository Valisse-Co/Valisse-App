import { describe, expect, it } from "vitest";
import {
  assertCalendarEventInput,
  eventAppliesOnDate,
  getSundayStart,
  intervalsOverlap,
} from "../shared/techCalendar";

describe("technician calendar helpers", () => {
  it("starts each week on Sunday", () => {
    expect(getSundayStart("2026-10-17")).toBe("2026-10-11");
    expect(getSundayStart("2026-10-18")).toBe("2026-10-18");
  });

  it("matches one-time and weekly calendar events only on their intended dates", () => {
    expect(eventAppliesOnDate({ recurrence: "once", localDate: "2026-10-17", dayOfWeek: null }, "2026-10-17")).toBe(true);
    expect(eventAppliesOnDate({ recurrence: "once", localDate: "2026-10-17", dayOfWeek: null }, "2026-10-18")).toBe(false);
    expect(eventAppliesOnDate({ recurrence: "weekly", localDate: null, dayOfWeek: 0 }, "2026-10-18")).toBe(true);
    expect(eventAppliesOnDate({ recurrence: "weekly", localDate: null, dayOfWeek: 0 }, "2026-10-19")).toBe(false);
  });

  it("treats calendar boundaries as non-overlapping and detects true conflicts", () => {
    expect(intervalsOverlap(9 * 60, 10 * 60, 10 * 60, 11 * 60)).toBe(false);
    expect(intervalsOverlap(9 * 60, 10 * 60, 9 * 60 + 30, 10 * 60 + 30)).toBe(true);
  });

  it("requires exactly one valid recurrence target and a valid time range", () => {
    expect(() => assertCalendarEventInput({ kind: "available", recurrence: "once", localDate: "2026-10-18", dayOfWeek: null, startTime: "09:00", endTime: "10:00", timeZone: "America/Denver" })).not.toThrow();
    expect(() => assertCalendarEventInput({ kind: "available", recurrence: "weekly", localDate: null, dayOfWeek: 1, startTime: "09:00", endTime: "10:00", timeZone: "America/Denver" })).not.toThrow();
    expect(() => assertCalendarEventInput({ kind: "unavailable", recurrence: "once", localDate: null, dayOfWeek: null, startTime: "10:00", endTime: "09:00", timeZone: "America/Denver" })).toThrow();
    expect(() => assertCalendarEventInput({ kind: "unavailable", recurrence: "weekly", localDate: null, dayOfWeek: 1, startTime: "09:00", endTime: "10:00", timeZone: "America/Denver" })).toThrow();
  });
});
