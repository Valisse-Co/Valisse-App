import { describe, expect, it } from "vitest";
import { CLIENT_BOTTOM_NAVIGATION, CLIENT_PROFILE_SAVED_PATH } from "../shared/clientNavigation";

describe("client bottom navigation", () => {
  it("keeps notifications visible in the bottom bar and saves inside Profile", () => {
    expect(CLIENT_BOTTOM_NAVIGATION.map((item) => item.href)).toEqual([
      "/discover",
      "/messages",
      "/bookings",
      "/notifications",
      "/profile",
    ]);
    expect(CLIENT_BOTTOM_NAVIGATION.some((item) => item.href === CLIENT_PROFILE_SAVED_PATH)).toBe(false);
    expect(CLIENT_PROFILE_SAVED_PATH).toBe("/saved");
  });
});
