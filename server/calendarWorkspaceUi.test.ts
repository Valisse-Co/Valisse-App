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
});
