import { describe, expect, it } from "vitest";
import { getOAuthPostLoginPath } from "./_core/oauth";

describe("OAuth post-login routing", () => {
  it("sends returning client accounts to Discover", () => {
    expect(getOAuthPostLoginPath({ onboardingCompleted: true, hasDualRole: false, userType: "client", activeMode: "client" }, "client@example.com", "login")).toBe("/discover");
  });

  it("sends returning nail-tech accounts and tech-mode hybrid accounts to Dashboard", () => {
    expect(getOAuthPostLoginPath({ onboardingCompleted: true, hasDualRole: false, userType: "nail_tech", activeMode: "nail_tech" }, "tech@example.com", "login")).toBe("/dashboard");
    expect(getOAuthPostLoginPath({ onboardingCompleted: true, hasDualRole: true, userType: "nail_tech", activeMode: "nail_tech" }, "hybrid@example.com", "login")).toBe("/dashboard");
  });

  it("sends new identities through a safely encoded Google confirmation step", () => {
    expect(getOAuthPostLoginPath(null, "new.user+test@example.com", "signup")).toBe("/signup/google-confirm?email=new.user%2Btest%40example.com&source=signup");
  });
});
