import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");

function source(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

describe("technician calendar workspace presentation", () => {
  it("renders the calendar from midnight through midnight and keeps seven fluid week columns", () => {
    const calendar = source("client/src/pages/TechCalendar.tsx");
    expect(calendar).toContain("const DAY_START = 0");
    expect(calendar).toContain("const DAY_END = 24 * 60");
    expect(calendar).toContain('grid-cols-[38px_repeat(7,minmax(0,1fr))]');
    expect(calendar).not.toContain('repeat(7,minmax(120px,1fr))');
  });

  it("opens a date-detail dialog over Month view rather than changing the active view", () => {
    const calendar = source("client/src/pages/TechCalendar.tsx");
    expect(calendar).toContain("const [monthDetailDate, setMonthDetailDate]");
    expect(calendar).toContain("onSelectDay={setMonthDetailDate}");
    expect(calendar).not.toContain('setAnchorDate(date); setView("day")');
  });

  it("keeps the booking list calendar alternative and promotes posts when no bookings exist", () => {
    const bookings = source("client/src/pages/TechBookings.tsx");
    expect(bookings).toContain("Calendar view");
    expect(bookings).toContain('navigate("/tech-calendar")');
    expect(bookings).toContain("Turn your best looks into bookings");
    expect(bookings).toContain('navigate("/dashboard?tab=posts")');
  });

  it("uses safe detail overlays, zoomable day geometry, and compact week/month appointment presentation", () => {
    const calendar = source("client/src/pages/TechCalendar.tsx");
    expect(calendar).toContain("const HOUR_HEIGHTS = [40, 56, 72, 88]");
    expect(calendar).toContain("setSelectedCalendarItem");
    expect(calendar).toContain("data-calendar-item");
    expect(calendar).toContain("pointerType === \"touch\"");
    expect(calendar).toContain('view === "week" ? 16 : 18, view === "week" ? 20');
    expect(calendar).toContain('dots.slice(0, 6)');
    expect(calendar).not.toContain("onEventDelete");
  });

  it("refreshes the calendar aggregate after schedule edits and replaces weekly rows atomically", () => {
    const bookings = source("client/src/pages/TechBookings.tsx");
    const database = source("server/db.ts");
    expect(bookings).toContain("utils.availability.calendar.invalidate()");
    expect(database).toContain("await db.transaction(async (tx) =>");
    expect(database).toContain("assertWeeklyScheduleInput(schedule)");
  });
});
