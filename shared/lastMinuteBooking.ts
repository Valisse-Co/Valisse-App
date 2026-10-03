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

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseLocalDateTime(slotDate: string, slotTime: string): ZonedDateTimeParts {
  if (!LOCAL_DATE_PATTERN.test(slotDate) || !LOCAL_TIME_PATTERN.test(slotTime)) {
    throw new Error("Last-minute slots need a valid local date and time.");
  }

  const [year, month, day] = slotDate.split("-").map(Number);
  const [hour, minute] = slotTime.split(":").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new Error("Last-minute slots need a valid local date.");
  }

  return { year, month, day, hour, minute, second: 0 };
}

function createTimeZoneFormatter(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error("Your device time zone could not be recognized. Please try again.");
  }
}

function getTimeZoneParts(epochMs: number, formatter: Intl.DateTimeFormat): ZonedDateTimeParts {
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(epochMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function getZonedDateTimeParts(epochMs: number, timeZone: string): ZonedDateTimeParts {
  return getTimeZoneParts(epochMs, createTimeZoneFormatter(timeZone));
}

export function getZonedDateKey(epochMs: number, timeZone: string): string {
  const parts = getZonedDateTimeParts(epochMs, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function addLocalDays(slotDate: string, days: number): string {
  if (!LOCAL_DATE_PATTERN.test(slotDate)) {
    throw new Error("Last-minute slots need a valid local date.");
  }
  const [year, month, day] = slotDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function getTimeZoneOffsetMs(epochMs: number, formatter: Intl.DateTimeFormat): number {
  const parts = getTimeZoneParts(epochMs, formatter);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - epochMs;
}

/**
 * Converts a wall-clock date and time in an IANA time zone into a UTC epoch.
 * Slots are entered in the technician's local time, while the server runs in
 * UTC; relying on `new Date("YYYY-MM-DDTHH:mm")` would expire them hours early.
 */
export function getZonedDateTimeEpoch(slotDate: string, slotTime: string, timeZone: string): number {
  const local = parseLocalDateTime(slotDate, slotTime);
  const formatter = createTimeZoneFormatter(timeZone);
  const wallClockEpoch = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );

  let epoch = wallClockEpoch - getTimeZoneOffsetMs(wallClockEpoch, formatter);
  epoch = wallClockEpoch - getTimeZoneOffsetMs(epoch, formatter);

  const resolved = getTimeZoneParts(epoch, formatter);
  if (
    resolved.year !== local.year ||
    resolved.month !== local.month ||
    resolved.day !== local.day ||
    resolved.hour !== local.hour ||
    resolved.minute !== local.minute
  ) {
    throw new Error("That local time does not exist because of daylight-saving time. Please choose another time.");
  }

  return epoch;
}

export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

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
