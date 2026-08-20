import { describe, expect, it } from "vitest";
import { getAppointmentTotals, getUnansweredQuestions } from "../shared/bookingComposition";

describe("combined booking composition", () => {
  it("uses the combined duration and price of every selected service", () => {
    expect(getAppointmentTotals([
      { id: 1, duration: 60, price: 55 },
      { id: 2, duration: 25, price: 15 },
    ])).toEqual({ durationMinutes: 85, totalPrice: 70 });
  });

  it("keeps shared Smart Match questions from being asked twice", () => {
    const questions = [
      { id: "condition", text: "What is currently on your nails?" },
      { id: "art", text: "Would you like nail art?" },
    ];
    expect(getUnansweredQuestions(questions, { "What is currently on your nails?": "Gel" }))
      .toEqual([{ id: "art", text: "Would you like nail art?" }]);
  });
});
