import { describe, expect, it } from "vitest";
import { evaluateSmartMatchRules } from "./smartMatch";

describe("evaluateSmartMatchRules", () => {
  it("returns an add-on outcome with its client-facing message when its conditions match", () => {
    const result = evaluateSmartMatchRules(
      { q1: "Detailed nail art" },
      [{
        if: ["Detailed nail art"],
        recommend: "Nail Art / Add-Ons",
        outcome: "addon",
        message: "Add nail art to your booking?",
      }],
    );

    expect(result).toEqual({
      outcome: "addon",
      recommendedService: "Nail Art / Add-Ons",
      message: "Add nail art to your booking?",
    });
  });

  it("requires every condition in a rule before returning that outcome", () => {
    const rules = [{
      if: ["Extensions", "Damaged"],
      recommend: "Tech Review",
      outcome: "review" as const,
    }];

    expect(evaluateSmartMatchRules({ q1: "Extensions" }, rules)).toEqual({
      outcome: "match",
      recommendedService: null,
      message: null,
    });
    expect(evaluateSmartMatchRules({ q1: "Extensions", q2: "Damaged" }, rules)).toMatchObject({
      outcome: "review",
      recommendedService: "Tech Review",
    });
  });
});
