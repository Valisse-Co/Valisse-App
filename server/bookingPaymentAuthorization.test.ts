import { describe, expect, it } from "vitest";
import { assertVerifiedBookingCardSetupIntent } from "../shared/bookingPaymentAuthorization";

const validSetupIntent = {
  status: "succeeded",
  customer: "cus_live_client",
  metadata: { client_id: "42", kind: "booking_payment_method" },
};

describe("booking card authorization", () => {
  it("allows a booking only after Stripe succeeds for the exact client", () => {
    expect(() => assertVerifiedBookingCardSetupIntent({
      setupIntent: validSetupIntent,
      customerId: "cus_live_client",
      clientId: 42,
    })).not.toThrow();
  });

  it("blocks a booking when the card confirmation has not succeeded", () => {
    expect(() => assertVerifiedBookingCardSetupIntent({
      setupIntent: { ...validSetupIntent, status: "requires_payment_method" },
      customerId: "cus_live_client",
      clientId: 42,
    })).toThrow("card was not verified");
  });

  it("blocks reuse of a setup intent for a different client", () => {
    expect(() => assertVerifiedBookingCardSetupIntent({
      setupIntent: validSetupIntent,
      customerId: "cus_live_client",
      clientId: 77,
    })).toThrow("card was not verified");
  });

  it("blocks payment setup intents not created for a booking card save", () => {
    expect(() => assertVerifiedBookingCardSetupIntent({
      setupIntent: { ...validSetupIntent, metadata: { client_id: "42", kind: "tip" } },
      customerId: "cus_live_client",
      clientId: 42,
    })).toThrow("card was not verified");
  });
});
