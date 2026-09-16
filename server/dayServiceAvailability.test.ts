import { describe, expect, it } from "vitest";
import {
  areServicesAvailableForDay,
  getInvalidServiceSelectionIds,
} from "../shared/dayServiceAvailability";

describe("day-level service availability", () => {
  it("treats an empty day selection as all active services", () => {
    expect(areServicesAvailableForDay([], [10, 20, 30])).toBe(true);
  });

  it("allows only a selected service on a restricted day", () => {
    expect(areServicesAvailableForDay([10], [10])).toBe(true);
    expect(areServicesAvailableForDay([10], [20])).toBe(false);
  });

  it("rejects schedule selections that are not owned and active for the technician", () => {
    // The trusted set is assembled by querying active services for the current tech.
    expect(getInvalidServiceSelectionIds([10, 20, 30], [10, 30])).toEqual([20]);
  });

  it("requires every service in a combined appointment to be available that day", () => {
    expect(areServicesAvailableForDay([10, 20], [10, 20])).toBe(true);
    expect(areServicesAvailableForDay([10, 20], [10, 30])).toBe(false);
  });
});
