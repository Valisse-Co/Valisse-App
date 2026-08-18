import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");

describe("required onboarding contact details", () => {
  it("requires name, mobile number, location, and an existing email identity before onboarding completes", () => {
    const routerSource = readFileSync(resolve(projectRoot, "server/routers.ts"), "utf8");

    expect(routerSource).toContain('name: z.string().trim().min(2, "Please enter your full name.")');
    expect(routerSource).toContain('"Please enter a valid mobile number."');
    expect(routerSource).toContain('location: z.string().trim().min(2, "Please enter your location.")');
    expect(routerSource).toContain('"An email address is required before completing onboarding."');
  });

  it("collects shared name and mobile details for every role while keeping SMS consent optional", () => {
    const onboardingSource = readFileSync(resolve(projectRoot, "client/src/pages/Onboarding.tsx"), "utf8");
    const consentSource = readFileSync(resolve(projectRoot, "client/src/pages/ConsentStep.tsx"), "utf8");

    expect(onboardingSource).toContain('currentStep === "contact"');
    expect(onboardingSource).toContain('placeholder="Full name"');
    expect(onboardingSource).toContain('placeholder="Mobile number"');
    expect(consentSource).toContain('(Optional)');
    expect(consentSource).toContain('const canProceed = tosChecked && privacyChecked;');
  });
});
