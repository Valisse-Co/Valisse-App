export type BookingCardSetupIntent = {
  status: string;
  customer: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};

export function assertVerifiedBookingCardSetupIntent(params: {
  setupIntent: BookingCardSetupIntent;
  customerId: string;
  clientId: number;
}): void {
  const actualCustomerId = typeof params.setupIntent.customer === "string"
    ? params.setupIntent.customer
    : params.setupIntent.customer?.id;
  const metadata = params.setupIntent.metadata ?? {};

  if (
    params.setupIntent.status !== "succeeded" ||
    actualCustomerId !== params.customerId ||
    metadata.kind !== "booking_payment_method" ||
    metadata.client_id !== String(params.clientId)
  ) {
    throw new Error("Your card was not verified for this booking. Please save your payment method and try again.");
  }
}
