import { describe, expect, it } from "vitest";
import {
  assertCalendarEventInput,
  assertWeeklyScheduleInput,
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

  it("requires a complete, non-overlapping weekly schedule with valid breaks", () => {
    const validWeek = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTime: "09:00", endTime: "17:00", isActive: dayOfWeek > 0, breakStart: dayOfWeek > 0 ? "12:00" : null, breakEnd: dayOfWeek > 0 ? "13:00" : null }));
    expect(() => assertWeeklyScheduleInput(validWeek)).not.toThrow();
    expect(() => assertWeeklyScheduleInput(validWeek.slice(0, 6))).toThrow();
    expect(() => assertWeeklyScheduleInput([{ ...validWeek[0], dayOfWeek: 1 }, ...validWeek.slice(1)])).toThrow();
    expect(() => assertWeeklyScheduleInput(validWeek.map((day) => day.dayOfWeek === 1 ? { ...day, breakStart: "16:00", breakEnd: "18:00" } : day))).toThrow();
  });
});
