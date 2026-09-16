import { describe, expect, it, vi } from "vitest";
import { completePaymentMethodSetup } from "../shared/paymentSetup";

describe("completePaymentMethodSetup", () => {
  it("saves the confirmed setup intent", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await completePaymentMethodSetup({
      confirm: async () => ({ setupIntent: { id: "seti_test" } }),
      save,
    });
    expect(save).toHaveBeenCalledWith("seti_test");
  });

  it("rejects thrown Stripe confirmation errors so the UI can clear its loading state", async () => {
    await expect(completePaymentMethodSetup({
      confirm: async () => { throw new Error("Network connection lost"); },
      save: vi.fn(),
    })).rejects.toThrow("Network connection lost");
  });

  it("times out an unresponsive card confirmation instead of leaving the button spinning", async () => {
    await expect(completePaymentMethodSetup({
      confirm: async () => new Promise(() => undefined),
      save: vi.fn(),
      timeoutMs: 1,
    })).rejects.toThrow("Secure card verification timed out");
  });

  it("surfaces a Stripe validation error without attempting the server completion mutation", async () => {
    const save = vi.fn();
    await expect(completePaymentMethodSetup({
      confirm: async () => ({ error: { message: "Your card number is incomplete." } }),
      save,
    })).rejects.toThrow("Your card number is incomplete.");
    expect(save).not.toHaveBeenCalled();
  });
});
