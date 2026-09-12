import { describe, expect, test } from "vitest";
import { isHelpKeyword, isStopKeyword, normalizeSmsPhone, phoneLookupCandidates } from "./telnyx";

describe("Telnyx SMS helpers", () => {
  test("normalizes supported U.S. customer phone formats to E.164", () => {
    expect(normalizeSmsPhone("6233325456")).toBe("+16233325456");
    expect(normalizeSmsPhone("+1 (623) 332-5456")).toBe("+16233325456");
    expect(normalizeSmsPhone("16233325456")).toBe("+16233325456");
    expect(normalizeSmsPhone("not a phone")).toBeNull();
  });

  test("builds lookup candidates for legacy and normalized stored numbers", () => {
    expect(phoneLookupCandidates("+16233325456")).toEqual(expect.arrayContaining(["+16233325456", "6233325456", "16233325456"]));
  });

  test("recognizes standard STOP and HELP keywords without overmatching normal messages", () => {
    expect(isStopKeyword("STOP")).toBe(true);
    expect(isStopKeyword("unsubscribe")).toBe(true);
    expect(isStopKeyword("please stop sending messages")).toBe(false);
    expect(isHelpKeyword("help")).toBe(true);
    expect(isHelpKeyword("information")).toBe(false);
  });
});
