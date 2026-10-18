import {
  createBookingFeeEvent,
  createNotification,
  getAppointmentFeePolicy,
  getAttendanceFeeEligibilityCandidates,
  getBookingFeeEvents,
  getBookingServiceDurationMinutes,
  getBookingServiceTotalInCents,
  markBookingFeeEventNotified,
  updateBookingFeeEvent,
} from "./db";
import { sendValisseTransactionalSms } from "./telnyx";
import {
  buildAppointmentFeePolicySnapshot,
  formatRuleFee,
  isCancellationFeeEligible,
  resolveAppointmentFeeAmountInCents,
  resolveAttendanceThresholdMinutes,
  type AppointmentFeePolicySnapshot,
  type AppointmentFeeRuleInput,
  type AppointmentFeeType,
} from "../shared/appointmentFeePolicy";
import { formatUsdCents } from "../shared/money";

type FeeEligibleBooking = {
  id: number;
  clientId: number;
  techId: number;
  scheduledAt: Date;
  duration: number;
  status: string;
  isQaTest: boolean;
  arrivedAt: Date | null;
  feePolicySnapshot: Record<string, unknown> | null;
};

function isPolicySnapshot(value: unknown): value is AppointmentFeePolicySnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { version?: unknown; rules?: unknown };
  return typeof candidate.version === "string" && Array.isArray(candidate.rules);
}

async function policyForBooking(booking: FeeEligibleBooking): Promise<AppointmentFeePolicySnapshot> {
  return isPolicySnapshot(booking.feePolicySnapshot)
    ? booking.feePolicySnapshot
    : getAppointmentFeePolicy(booking.techId);
}

function ruleFor(snapshot: AppointmentFeePolicySnapshot, feeType: AppointmentFeeType): AppointmentFeeRuleInput | undefined {
  return snapshot.rules.find((rule) => rule.ruleType === feeType);
}

async function notifyFeeEligibility(params: {
  eventId: number;
  booking: FeeEligibleBooking;
  feeType: AppointmentFeeType;
  amountInCents: number;
  reason: string;
}) {
  if (params.booking.isQaTest) return;
  const label = params.feeType === "late_arrival" ? "late arrival" : params.feeType.replace("_", " ");
  await createNotification({
    userId: params.booking.clientId,
    type: "appointment_fee_eligible",
    title: `${formatUsdCents(params.amountInCents)} ${label} fee awaiting review`,
    body: `${params.reason} Your nail tech must confirm this fee before any card charge is attempted.`,
    relatedId: params.booking.id,
  });
  await markBookingFeeEventNotified(params.eventId, "in_app");

  try {
    const delivered = await sendValisseTransactionalSms({
      userId: params.booking.clientId,
      category: "appointment_fee_eligible",
      text: `Valisse: a ${formatUsdCents(params.amountInCents)} ${label} fee is eligible for your appointment. Your nail tech must confirm it before any charge. View details in Valisse. Reply STOP to opt out.`,
    });
    if (delivered) await markBookingFeeEventNotified(params.eventId, "sms");
  } catch (error) {
    console.warn("[Appointment fee] Eligibility SMS failed", params.eventId, error);
  }
}

/**
 * Creates a pending case only. This function never charges a saved card; the
 * technician has to choose Confirm fee in a separate protected action.
 */
export async function createEligibleAttendanceFee(params: {
  booking: FeeEligibleBooking;
  feeType: "late_arrival" | "no_show";
  now?: Date;
}) {
  const { booking, feeType, now = new Date() } = params;
  if (feeType === "late_arrival") {
    if (!booking.arrivedAt || !["confirmed", "in_progress"].includes(booking.status)) return null;
  } else if (booking.arrivedAt || booking.status !== "confirmed") {
    return null;
  }

  const snapshot = await policyForBooking(booking);
  const rule = ruleFor(snapshot, feeType);
  if (!rule?.enabled) return null;

  const [serviceTotalInCents, serviceDurationMinutes, existingEvents] = await Promise.all([
    getBookingServiceTotalInCents(booking.id),
    getBookingServiceDurationMinutes(booking.id),
    getBookingFeeEvents(booking.id),
  ]);
  const thresholdMinutes = resolveAttendanceThresholdMinutes(rule, serviceDurationMinutes || booking.duration);
  const eligibilityTime = feeType === "late_arrival" ? booking.arrivedAt!.getTime() : now.getTime();
  if (!thresholdMinutes || eligibilityTime < booking.scheduledAt.getTime() + thresholdMinutes * 60_000) return null;

  // A no-show is the stronger attendance finding. It replaces an unconfirmed
  // late case; after a tech confirms late, we never create a second fee.
  if (feeType === "no_show") {
    const late = existingEvents.find((event) => event.feeType === "late_arrival");
    if (late?.status === "eligible_pending_tech") await updateBookingFeeEvent(late.id, { status: "voided_arrived" });
    if (late && !["voided_arrived", "waived"].includes(late.status)) return null;
  }
  if (feeType === "late_arrival" && existingEvents.some((event) => event.feeType === "no_show")) return null;

  const amountInCents = resolveAppointmentFeeAmountInCents(rule, serviceTotalInCents);
  if (amountInCents <= 0) return null;
  const reason = feeType === "late_arrival"
    ? `The client checked in ${Math.max(thresholdMinutes, Math.round((booking.arrivedAt!.getTime() - booking.scheduledAt.getTime()) / 60_000))} minutes after the scheduled start.`
    : `The appointment remained unchecked-in for ${thresholdMinutes} minutes after the scheduled start.`;
  const { event, created } = await createBookingFeeEvent({
    bookingId: booking.id,
    clientId: booking.clientId,
    techId: booking.techId,
    feeType,
    amountInCents,
    policySnapshot: {
      policyVersion: snapshot.version,
      rule,
      serviceTotalInCents,
      serviceDurationMinutes,
      thresholdMinutes,
      configuredFee: formatRuleFee(rule),
    },
    eligibleAt: now,
    eligibilityReason: reason,
  });
  if (created) await notifyFeeEligibility({ eventId: event.id, booking, feeType, amountInCents, reason });
  return event;
}

/** Creates a late-cancellation case without any automatic card charge. */
export async function createEligibleCancellationFee(params: {
  booking: FeeEligibleBooking & { createdAt: Date };
  now?: Date;
}) {
  const { booking, now = new Date() } = params;
  const snapshot = await policyForBooking(booking);
  const rule = ruleFor(snapshot, "cancellation");
  if (!rule || !isCancellationFeeEligible({ rule, scheduledAt: booking.scheduledAt, bookedAt: booking.createdAt, now })) return null;
  const total = await getBookingServiceTotalInCents(booking.id);
  const amountInCents = resolveAppointmentFeeAmountInCents(rule, total);
  if (amountInCents <= 0) return null;
  const reason = `The cancellation was within the ${rule.noticeHours}-hour notice window.`;
  const { event, created } = await createBookingFeeEvent({
    bookingId: booking.id,
    clientId: booking.clientId,
    techId: booking.techId,
    feeType: "cancellation",
    amountInCents,
    policySnapshot: {
      policyVersion: snapshot.version,
      rule,
      serviceTotalInCents: total,
      configuredFee: formatRuleFee(rule),
    },
    eligibleAt: now,
    eligibilityReason: reason,
  });
  if (created) await notifyFeeEligibility({ eventId: event.id, booking, feeType: "cancellation", amountInCents, reason });
  return event;
}

export async function evaluateAttendanceFeeEligibility(now = new Date()) {
  const candidates = await getAttendanceFeeEligibilityCandidates(now);
  let created = 0;
  for (const booking of candidates) {
    const snapshot = await policyForBooking(booking);
    const noShow = ruleFor(snapshot, "no_show");
    const duration = await getBookingServiceDurationMinutes(booking.id);
    const noShowThreshold = noShow ? resolveAttendanceThresholdMinutes(noShow, duration || booking.duration) : null;
    if (!noShowThreshold || now.getTime() < booking.scheduledAt.getTime() + noShowThreshold * 60_000) continue;
    const result = await createEligibleAttendanceFee({ booking, feeType: "no_show", now });
    if (result) created += 1;
  }
  return { checked: candidates.length, created };
}
