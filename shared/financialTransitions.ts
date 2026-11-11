export const FINANCIAL_ISSUE_WINDOW_MS = 24 * 60 * 60 * 1000;

export class FinancialTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinancialTransitionError";
  }
}

export type BookingFinancialState = {
  status: string;
  paymentStatus: string;
  payoutStatus: string;
  revisionStatus: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
  paymentCapturedAt?: Date | null;
  payoutEligibleAt?: Date | null;
  stripePaymentIntentId?: string | null;
  stripeTipPaymentIntentId?: string | null;
  tipStatus: string;
  tipAmountInCents: number;
  issueReportedAt?: Date | null;
  issueReason?: string | null;
  issueResolution?: string | null;
  issueResolvedAt?: Date | null;
};

function reject(message: string): never {
  throw new FinancialTransitionError(message);
}

export function assertUnpaidPendingBooking(booking: BookingFinancialState): void {
  if (booking.status !== "pending" || booking.paymentStatus !== "unpaid" || booking.startedAt || booking.completedAt || booking.paymentCapturedAt || booking.stripePaymentIntentId) {
    reject("Only an unpaid, pending booking request can be changed before confirmation or start.");
  }
}

export function assertGenericBookingStatus(booking: BookingFinancialState, status: string): void {
  if (status === "completed") reject("Complete the code-verified appointment through the payment completion flow.");
  if (status === "confirmed" || status === "declined") {
    assertUnpaidPendingBooking(booking);
    if (booking.revisionStatus === "pending") reject("Wait for the client to respond to the pending revised quote.");
    return;
  }
  if (status !== "cancelled" || !["pending", "confirmed"].includes(booking.status) || booking.paymentStatus !== "unpaid" || booking.startedAt || booking.completedAt || booking.paymentCapturedAt || booking.stripePaymentIntentId) {
    reject("Only an unpaid booking that has not started can be cancelled.");
  }
}

export function hasUnresolvedBookingIssue(booking: BookingFinancialState): boolean {
  return booking.status === "disputed" || booking.payoutStatus === "on_hold" || Boolean((booking.issueReportedAt || booking.issueReason) && (!booking.issueResolvedAt || !booking.issueResolution || booking.issueResolution === "none"));
}

export function isWithinOriginalIssueWindow(booking: BookingFinancialState, now: Date): boolean {
  const completed = booking.completedAt?.getTime();
  const eligible = booking.payoutEligibleAt?.getTime();
  const captured = booking.paymentCapturedAt?.getTime();
  const current = now.getTime();
  return Number.isFinite(current) && typeof completed === "number" && Number.isFinite(completed) && typeof eligible === "number" && Number.isFinite(eligible) && completed <= current && (captured == null || (Number.isFinite(captured) && captured <= current)) && eligible > completed && current < completed + FINANCIAL_ISSUE_WINDOW_MS && current < eligible;
}

export function assertBookingIssueReport(booking: BookingFinancialState, now: Date): void {
  if (booking.status !== "completed" || booking.paymentStatus !== "paid" || booking.payoutStatus !== "pending_dispute_window" || booking.issueReportedAt || booking.issueReason || booking.issueResolvedAt || (booking.issueResolution && booking.issueResolution !== "none")) {
    reject("This booking is not currently eligible for an issue report.");
  }
  if (!isWithinOriginalIssueWindow(booking, now)) reject("The original 24-hour issue-report window has ended or the completion dates are invalid.");
}

export function assertPaidCompletedTipBooking(booking: BookingFinancialState): void {
  if (booking.status !== "completed" || booking.paymentStatus !== "paid" || hasUnresolvedBookingIssue(booking)) {
    reject("Tips require a paid, completed appointment with no unresolved issue.");
  }
}

export function assertTipChoiceWindow(booking: BookingFinancialState, now: Date): void {
  assertPaidCompletedTipBooking(booking);
  if (booking.payoutStatus !== "pending_dispute_window" || !isWithinOriginalIssueWindow(booking, now)) reject("The 24-hour tip-choice window has ended.");
  if (["paid", "declined", "refunded"].includes(booking.tipStatus)) reject("A final tip choice has already been recorded for this appointment.");
}

export function assertTipAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 50 || amount > 100_000) reject("Choose a tip amount between $0.50 and $1,000.");
}

export function isMatchingStoredTip(booking: BookingFinancialState, intentId: string, amount: number): boolean {
  return booking.stripeTipPaymentIntentId === intentId && booking.tipAmountInCents === amount;
}

/** A reserved intent is persisted with tipStatus=none; no schema migration is required. */
export function assertPendingTipReservation(booking: BookingFinancialState, intentId: string, amount: number, now: Date): void {
  assertTipAmount(amount);
  assertTipChoiceWindow(booking, now);
  if (booking.stripeTipPaymentIntentId && !isMatchingStoredTip(booking, intentId, amount)) reject("Finish the current tip first. Reopen it using the same amount.");
}

/** Verified completion may arrive after the window, but must use the previously reserved intent. */
export function assertStoredTipCompletion(booking: BookingFinancialState, intentId: string, amount: number): void {
  assertTipAmount(amount);
  if (booking.tipStatus === "paid" && isMatchingStoredTip(booking, intentId, amount)) return;
  assertPaidCompletedTipBooking(booking);
  if (booking.tipStatus !== "none" || !isMatchingStoredTip(booking, intentId, amount)) reject("This tip does not match the pending tip choice, or a final tip choice was already recorded.");
}

export type FinancialServiceLine = {
  techServiceId: number | null;
  serviceName: string;
  lineType: "primary" | "addon" | "upgrade";
  priceInCents: number;
  durationMinutes: number;
  position: number;
};

export function validateFinancialServiceLines(input: readonly FinancialServiceLine[]): FinancialServiceLine[] {
  if (!Array.isArray(input) || !input.length || input.length > 100) reject("A revised quote must include valid service lines.");
  const positions = new Set<number>();
  const serviceIds = new Set<number>();
  let price = 0;
  let duration = 0;
  const lines = input.map((line) => {
    if (!line || typeof line.serviceName !== "string" || !line.serviceName.trim() || line.serviceName.length > 128 || !["primary", "addon", "upgrade"].includes(line.lineType) || !Number.isSafeInteger(line.priceInCents) || line.priceInCents < 0 || !Number.isSafeInteger(line.durationMinutes) || line.durationMinutes < 0 || !Number.isSafeInteger(line.position) || line.position < 0 || positions.has(line.position) || (line.techServiceId !== null && (!Number.isSafeInteger(line.techServiceId) || line.techServiceId <= 0 || serviceIds.has(line.techServiceId)))) reject("The revised service amounts, durations, or selections are invalid.");
    positions.add(line.position);
    if (line.techServiceId !== null) serviceIds.add(line.techServiceId);
    price += line.priceInCents;
    duration += line.durationMinutes;
    // Copy only known snapshot fields: untrusted JSON must not supply bookingId or other columns.
    return { techServiceId: line.techServiceId, serviceName: line.serviceName, lineType: line.lineType, priceInCents: line.priceInCents, durationMinutes: line.durationMinutes, position: line.position };
  });
  if (lines.filter((line) => line.lineType === "primary").length !== 1 || price < 1 || price > 2_147_483_647 || duration < 1 || duration > 2_147_483_647) reject("A quote needs one primary service and valid positive totals.");
  return lines;
}
