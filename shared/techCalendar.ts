export type CalendarEventKind = "available" | "unavailable";
export type CalendarEventRecurrence = "once" | "weekly";
export type CalendarClientTier = "open" | "returning_only";

export type CalendarEventInput = {
  kind: CalendarEventKind;
  recurrence: CalendarEventRecurrence;
  localDate?: string | null;
  dayOfWeek?: number | null;
  startTime: string;
  endTime: string;
  clientTier?: CalendarClientTier;
  title?: string | null;
  timeZone: string;
};

export type WeeklyScheduleInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  breakStart?: string | null;
  breakEnd?: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function assertCalendarEventInput(input: CalendarEventInput) {
  if (!TIME_PATTERN.test(input.startTime) || !TIME_PATTERN.test(input.endTime) || input.startTime >= input.endTime) {
    throw new Error("Choose a valid calendar time range.");
  }
  // A recurring blackout could collide with appointments far into the future.
  // Recurring work hours are safe; unavailability must be reviewed per date.
  if (input.kind === "unavailable" && input.recurrence !== "once") {
    throw new Error("Unavailable calendar time must be added for one date so affected appointments can be reviewed.");
  }
  if (input.recurrence === "once") {
    if (!input.localDate || !DATE_PATTERN.test(input.localDate) || input.dayOfWeek !== null && input.dayOfWeek !== undefined) {
      throw new Error("One-time calendar events need one valid date.");
    }
  } else if (input.dayOfWeek === null || input.dayOfWeek === undefined || !Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6 || input.localDate) {
    throw new Error("Weekly calendar events need one day of the week.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input.timeZone });
  } catch {
    throw new Error("Your time zone could not be recognized. Please try again.");
  }
}

export function intervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

export function assertWeeklyScheduleInput(schedule: WeeklyScheduleInput[]) {
  const days = schedule.map((day) => day.dayOfWeek);
  if (schedule.length !== 7 || new Set(days).size !== 7 || !days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) {
    throw new Error("Provide exactly one schedule for each day of the week.");
  }
  for (const day of schedule) {
    if (!TIME_PATTERN.test(day.startTime) || !TIME_PATTERN.test(day.endTime) || day.startTime >= day.endTime) {
      throw new Error("Each workday needs a valid start and end time.");
    }
    const hasBreakStart = Boolean(day.breakStart);
    const hasBreakEnd = Boolean(day.breakEnd);
    if (hasBreakStart !== hasBreakEnd) throw new Error("Breaks need both a start and end time.");
    if (hasBreakStart && hasBreakEnd && (!TIME_PATTERN.test(day.breakStart!) || !TIME_PATTERN.test(day.breakEnd!) || day.breakStart! >= day.breakEnd! || day.breakStart! < day.startTime || day.breakEnd! > day.endTime)) {
      throw new Error("Each break must fit within that workday.");
    }
  }
}

export function getDayOfWeekFromLocalDate(localDate: string): number {
  if (!DATE_PATTERN.test(localDate)) throw new Error("Calendar events need a valid local date.");
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Calendar events need a valid local date.");
  }
  return date.getUTCDay();
}

export function eventAppliesOnDate(event: Pick<CalendarEventInput, "recurrence" | "localDate" | "dayOfWeek">, localDate: string): boolean {
  return event.recurrence === "once"
    ? event.localDate === localDate
    : event.dayOfWeek === getDayOfWeekFromLocalDate(localDate);
}

export function getSundayStart(localDate: string): string {
  const dayOfWeek = getDayOfWeekFromLocalDate(localDate);
  const [year, month, day] = localDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day - dayOfWeek));
  return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
}
