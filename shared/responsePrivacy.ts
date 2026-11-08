import type { Booking, BookingFeeEvent, User } from "../drizzle/schema";

/** Explicit response contracts: adding a database column must not publish it. */
export const PUBLIC_IDENTITY_FIELDS = [
  "id", "name", "businessName", "avatarUrl", "userType", "hasDualRole",
] as const satisfies readonly (keyof User)[];

export const PUBLIC_TECHNICIAN_FIELDS = [
  ...PUBLIC_IDENTITY_FIELDS,
  "bio", "services", "priceRange", "instagramHandle", "yearsExperience",
  "smartMatchEnabled", "addressCity", "addressState", "fuzzedLat", "fuzzedLng",
] as const satisfies readonly (keyof User)[];

export const PARTICIPANT_BOOKING_FIELDS = [
  "id", "clientId", "techId", "postId", "inspirationImageUrl", "serviceType",
  "addonServiceId", "scheduledAt", "duration", "status", "depositPaid", "notes",
  "techNotes", "cancelledBy", "cancelledAt", "cancellationReason",
  "calendarOverrideEventId", "cancellationFeeStatus", "cancellationFeeAmount",
  "needsReview", "reviewAnswers", "reviewRecommendedService", "reviewPhotoUrls",
  "revisionStatus", "appointmentCodeVisibleAt", "arrivedAt", "arrivalMethod",
  "startedAt", "completedAt", "feePolicyVersion", "feePolicySnapshot",
  "feePolicyAcknowledgedAt", "paymentMethodStatus", "paymentStatus", "payoutStatus",
  "tipStatus", "tipAmountInCents", "payoutEligibleAt", "paymentCapturedAt",
  "issueReportedAt", "issueReason", "issueResolution", "issueResolutionNote",
  "issueResolvedAt", "issueResolvedBy", "refundAmountInCents", "isQaTest",
  "createdAt", "updatedAt",
] as const satisfies readonly (keyof Booking)[];

export const PARTICIPANT_FEE_EVENT_FIELDS = [
  "id", "bookingId", "clientId", "techId", "feeType", "status", "amountInCents",
  "policySnapshot", "eligibleAt", "eligibilityReason", "notifiedAt", "smsNotifiedAt",
  "techConfirmedAt", "techConfirmedBy", "waivedAt", "waivedBy", "chargedAt",
  "chargeFailureReason", "payoutEligibleAt", "payoutStatus", "clientDisputedAt",
  "clientDisputeReason", "adminResolvedAt", "adminResolvedBy", "adminResolutionNote",
  "createdAt", "updatedAt",
] as const satisfies readonly (keyof BookingFeeEvent)[];

export type PublicIdentity = Pick<User, typeof PUBLIC_IDENTITY_FIELDS[number]>;
export type PublicTechnician = Pick<User, typeof PUBLIC_TECHNICIAN_FIELDS[number]> & {
  location: string | null;
};
export type ParticipantBooking = Pick<Booking, typeof PARTICIPANT_BOOKING_FIELDS[number]>;
export type ParticipantFeeEvent = Pick<BookingFeeEvent, typeof PARTICIPANT_FEE_EVENT_FIELDS[number]>;
export type PublicLocationPrivacy = { hideApproxLocation?: boolean | null };

function pick<T extends object, K extends keyof T>(source: T, fields: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const field of fields) result[field] = source[field];
  return result;
}

export function toPublicIdentity(user: PublicIdentity): PublicIdentity;
export function toPublicIdentity(user: PublicIdentity | null | undefined): PublicIdentity | null;
export function toPublicIdentity(user: PublicIdentity | null | undefined): PublicIdentity | null {
  return user ? pick(user, PUBLIC_IDENTITY_FIELDS) : null;
}

/** Referral-only visibility is a discovery rule, not a direct-profile access rule.
 * Never fall back to legacy free-form location or real coordinates. */
export function toPublicTechnician(user: Pick<User, typeof PUBLIC_TECHNICIAN_FIELDS[number]>, privacy?: PublicLocationPrivacy | null): PublicTechnician;
export function toPublicTechnician(user: Pick<User, typeof PUBLIC_TECHNICIAN_FIELDS[number]> | null | undefined, privacy?: PublicLocationPrivacy | null): PublicTechnician | null;
export function toPublicTechnician(user: Pick<User, typeof PUBLIC_TECHNICIAN_FIELDS[number]> | null | undefined, privacy?: PublicLocationPrivacy | null): PublicTechnician | null {
  if (!user) return null;
  const result = pick(user, PUBLIC_TECHNICIAN_FIELDS);
  // A dual-role account's client city must never substitute for its business city.
  const techCapable = user.userType === "nail_tech" || user.hasDualRole;
  const addressCity = techCapable ? user.addressCity : null;
  const addressState = techCapable ? user.addressState : null;
  return {
    ...result,
    addressCity,
    addressState,
    location: [addressCity, addressState].filter(Boolean).join(", ") || null,
    fuzzedLat: techCapable && !privacy?.hideApproxLocation ? user.fuzzedLat : null,
    fuzzedLng: techCapable && !privacy?.hideApproxLocation ? user.fuzzedLng : null,
  };
}

/** Security/provider metadata is also excluded from extensible JSON snapshots.
 * Free-text notes and cancellation/dispute reasons intentionally remain intact. */
function withoutPrivateMetadata<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutPrivateMetadata) as T;
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !/^(?:stripe.*|passwordHash|appointmentCodeHash|openId|sessionVersion|email|phone|lat|lng|clientLat|clientLng|fullAddress|businessAddress|addressLine1|addressLine2|addressPostalCode|clientPostalCode)$/i.test(key)
  ).map(([key, item]) => [key, withoutPrivateMetadata(item)])) as T;
}

export function toParticipantBooking(booking: Booking): ParticipantBooking;
export function toParticipantBooking(booking: Booking | null | undefined): ParticipantBooking | null;
export function toParticipantBooking(booking: Booking | null | undefined): ParticipantBooking | null {
  return booking ? withoutPrivateMetadata(pick(booking, PARTICIPANT_BOOKING_FIELDS)) : null;
}

export function toParticipantFeeEvent(event: BookingFeeEvent): ParticipantFeeEvent {
  return withoutPrivateMetadata(pick(event, PARTICIPANT_FEE_EVENT_FIELDS));
}

/** The only identity response that may contain an exact address. Authorization
 * belongs to the caller; match the technician and require the client's role. */
export function toBookingCounterpart(
  user: (PublicIdentity & Pick<User, "fullAddress">) | null | undefined,
  booking: Pick<Booking, "techId" | "status">,
  viewerRole: "client" | "nail_tech",
): (PublicIdentity & { fullAddress: string | null }) | null {
  if (!user) return null;
  return {
    ...toPublicIdentity(user),
    fullAddress: viewerRole === "client" && booking.status === "confirmed" && user.id === booking.techId
      ? user.fullAddress : null,
  };
}
