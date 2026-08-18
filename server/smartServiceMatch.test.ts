import { describe, expect, it } from "vitest";
import { evaluateSmartServiceMatch, SMART_SERVICE_MATCH_CONFIGS } from "./smartServiceMatch";

describe("evaluateSmartServiceMatch", () => {
  it("returns a safety or damage review before lower-priority recommendations and add-ons", () => {
    const result = evaluateSmartServiceMatch(
      { condition: "Damaged", length: "Needs extensions", art: "Detailed art" },
      [
        { priority: 700, whenAll: ["Needs extensions"], action: "recommend_service", service: "Gel-X / Soft Gel Extensions", explanation: "Extensions fit best." },
        { priority: 500, whenAll: ["Detailed art"], action: "add_service", service: "Nail Art / Add-Ons", explanation: "Art takes extra time." },
        { priority: 1000, whenAll: ["Damaged"], action: "review", service: "Repair", explanation: "Damage needs review." },
      ]
    );

    expect(result).toEqual({
      outcome: "review",
      recommendedService: "Repair",
      recommendedAddOns: [],
      explanation: "Damage needs review.",
      needsReview: true,
    });
  });

  it("combines all applicable add-ons instead of stopping at the first matching rule", () => {
    const result = evaluateSmartServiceMatch(
      { removal: "Existing product", art: "Detailed art" },
      [
        { priority: 500, whenAll: ["Existing product"], action: "add_service", service: "Removal / Soak-Off", explanation: "Removal is needed." },
        { priority: 500, whenAll: ["Detailed art"], action: "add_service", service: "Nail Art / Add-Ons", explanation: "Art takes extra time." },
      ]
    );

    expect(result.outcome).toBe("recommendation");
    expect(result.recommendedService).toBeNull();
    expect(result.recommendedAddOns).toEqual(["Removal / Soak-Off", "Nail Art / Add-Ons"]);
  });

  it("returns a clear match when no system rule applies", () => {
    expect(evaluateSmartServiceMatch({ preference: "Simple" }, [])).toMatchObject({
      outcome: "match",
      needsReview: false,
      recommendedAddOns: [],
    });
  });

  it("ships system questionnaires for every core category and both independent fill services", () => {
    const categories = SMART_SERVICE_MATCH_CONFIGS.map((config) => config.serviceCategory);
    expect(categories).toEqual(expect.arrayContaining([
      "Gel Manicure",
      "Structured Gel / Builder Gel",
      "Structured Gel / Builder Gel Fill",
      "Acrylic Full Set",
      "Acrylic Fill",
      "Extended Fill",
      "Gel-X / Soft Gel Extensions",
      "Dip Powder",
      "Manicure",
      "Pedicure",
      "Nail Art / Add-Ons",
      "Removal / Soak-Off",
      "Repair",
      "Press-On Nails",
      "Custom / Not Sure",
    ]));
    expect(SMART_SERVICE_MATCH_CONFIGS.find((config) => config.serviceCategory === "Structured Gel / Builder Gel Fill")?.questions.length).toBeGreaterThan(0);
    expect(SMART_SERVICE_MATCH_CONFIGS.find((config) => config.serviceCategory === "Extended Fill")?.questions.length).toBeGreaterThan(0);
  });
});
