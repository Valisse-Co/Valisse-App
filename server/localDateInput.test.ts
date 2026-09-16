import { describe, expect, it } from "vitest";
import { getLocalDateInputRange, toLocalDateInputValue } from "../shared/localDateInput";

describe("local date-input ranges", () => {
  it("formats the local calendar day without converting it to UTC", () => {
    const localEvening = new Date(2026, 8, 15, 21, 20, 0);
    expect(toLocalDateInputValue(localEvening)).toBe("2026-09-15");
  });

  it("keeps tonight selectable and allows dates through seven local calendar days ahead", () => {
    const localEvening = new Date(2026, 8, 15, 21, 20, 0);
    expect(getLocalDateInputRange(7, localEvening)).toEqual({
      min: "2026-09-15",
      max: "2026-09-22",
    });
  });
});
