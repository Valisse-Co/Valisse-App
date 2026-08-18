import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");

describe("startup and onboarding routing contracts", () => {
  it("keeps the root route on the independent Login page", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/App.tsx"), "utf8");
    expect(appSource).toContain('<Route path="/" component={Login} />');
  });

  it("does not render the retired floating demo switcher", () => {
    const appSource = readFileSync(resolve(projectRoot, "client/src/App.tsx"), "utf8");
    expect(appSource).not.toContain("DemoBar");
  });

  it("uses Profile rather than Alerts or Reports in the client bottom navigation", () => {
    const layoutSource = readFileSync(resolve(projectRoot, "client/src/components/AppLayout.tsx"), "utf8");
    expect(layoutSource).toContain('{ label: "Profile", icon: <UserRound size={22} />, href: "/profile" }');
    expect(layoutSource).not.toContain('label: "Alerts"');
    expect(layoutSource).not.toContain('label: "Reports"');
  });

  it("requires an explicit new-account intent before an incomplete account can enter onboarding", () => {
    const loginSource = readFileSync(resolve(projectRoot, "client/src/pages/Login.tsx"), "utf8");
    const onboardingSource = readFileSync(resolve(projectRoot, "client/src/pages/Onboarding.tsx"), "utf8");
    const signUpSource = readFileSync(resolve(projectRoot, "client/src/pages/SignUp.tsx"), "utf8");

    expect(loginSource).toContain('sessionStorage.getItem("valisse_onboarding_intent") === "new_account"');
    expect(onboardingSource).toContain('const hasOnboardingIntent = sessionStorage.getItem("valisse_onboarding_intent") === "new_account"');
    expect(signUpSource).toContain('sessionStorage.setItem("valisse_onboarding_intent", "new_account")');
  });
});
