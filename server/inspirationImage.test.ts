import { describe, expect, it } from "vitest";
import { isValidInspirationImageReference } from "../shared/inspirationImage";

describe("Book This Look inspiration image validation", () => {
  it("accepts a Valisse internal storage path", () => {
    expect(isValidInspirationImageReference("/manus-storage/posts/90044/look.png")).toBe(true);
  });

  it("accepts secure absolute image URLs but rejects malformed or unsafe references", () => {
    expect(isValidInspirationImageReference("https://images.example.com/look.png")).toBe(true);
    expect(isValidInspirationImageReference("/manus-storage/../private.png")).toBe(false);
    expect(isValidInspirationImageReference("javascript:alert(1)")).toBe(false);
    expect(isValidInspirationImageReference("not an image path")).toBe(false);
  });
});
