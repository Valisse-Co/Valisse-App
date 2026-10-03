export type NotificationLike = {
  type: string;
  title: string;
  body: string | null;
  relatedId: number | null;
};

export type BookingNotificationContext = {
  bookingId: number;
  clientId: number;
  techId: number;
  clientName: string | null;
  techName: string | null;
  serviceName: string | null;
  durationMinutes: number | null;
  issueReason: string | null;
  recipientId: number;
  recipientRole: "admin" | "user";
};

export const BOOKING_NOTIFICATION_TYPES = new Set([
  "new_booking",
  "booking_confirmed",
  "booking_declined",
  "booking_cancelled_by_tech",
  "booking_revision",
  "booking_revision_response",
  "appointment_started",
  "booking_payment_captured",
  "payout_pending",
  "payment_due",
  "booking_issue_reported",
  "issue_resolved",
  "tip_received",
  "payout_released",
]);

export function isBookingNotification(type: string): boolean {
  return BOOKING_NOTIFICATION_TYPES.has(type);
}

export function getNotificationDestination(
  notification: NotificationLike,
  booking?: BookingNotificationContext,
): string | null {
  if (!notification.relatedId) return null;
  if (notification.type === "last_minute_slot") return `/book-last-minute/${notification.relatedId}`;
  if (notification.type === "new_post") return `/post/${notification.relatedId}?from=/notifications`;

  if (booking && isBookingNotification(notification.type)) {
    if (booking.recipientId === booking.techId) return `/tech-bookings?bookingId=${booking.bookingId}`;
    if (booking.recipientId === booking.clientId) return `/bookings?bookingId=${booking.bookingId}`;
    if (booking.recipientRole === "admin") return `/admin/reports?bookingId=${booking.bookingId}`;
  }

  if (notification.type === "system" && booking?.recipientRole === "admin") return "/admin/reports";
  return null;
}

function bookingSummary(booking: BookingNotificationContext): string {
  const service = booking.serviceName || "Appointment service";
  const duration = booking.durationMinutes ? ` · ${booking.durationMinutes} min` : "";
  return `${service}${duration}`;
}

function notificationCounterpart(booking: BookingNotificationContext): { role: string; name: string } {
  if (booking.recipientId === booking.techId) return { role: "Client", name: booking.clientName || "Client" };
  if (booking.recipientId === booking.clientId) return { role: "Nail tech", name: booking.techName || "Your nail tech" };
  return { role: "Client", name: booking.clientName || "Client" };
}

export function presentNotification(
  notification: NotificationLike,
  booking?: BookingNotificationContext,
): {
  title: string;
  body: string | null;
  destination: string | null;
  actionLabel: string;
  details: { personLabel: string; personName: string; serviceSummary: string; issueReason: string | null } | null;
} {
  const destination = getNotificationDestination(notification, booking);
  if (!booking || !isBookingNotification(notification.type)) {
    return {
      title: notification.title,
      body: notification.body,
      destination,
      actionLabel: notification.type === "last_minute_slot" ? "Book Now" : destination ? "View details" : "View",
      details: null,
    };
  }

  const counterpart = notificationCounterpart(booking);
  const serviceSummary = bookingSummary(booking);
  const details = {
    personLabel: counterpart.role,
    personName: counterpart.name,
    serviceSummary,
    issueReason: booking.issueReason,
  };

  if (notification.type === "new_booking") {
    return {
      title: `New booking request from ${counterpart.name}`,
      body: `${serviceSummary} · Review the request and respond.`,
      destination,
      actionLabel: "Review booking",
      details,
    };
  }

  if (notification.type === "booking_issue_reported") {
    const title = booking.recipientRole === "admin" && booking.recipientId !== booking.techId
      ? `Appointment issue: ${booking.clientName || "Client"} and ${booking.techName || "nail tech"}`
      : `Issue reported by ${counterpart.name}`;
    const reason = booking.issueReason ? `Reason: ${booking.issueReason}` : "The payout is paused while the issue is reviewed.";
    return {
      title,
      body: `${serviceSummary} · ${reason}`,
      destination,
      actionLabel: booking.recipientRole === "admin" && booking.recipientId !== booking.techId ? "Review issue" : "View appointment",
      details,
    };
  }

  const titleOverrides: Record<string, string> = {
    booking_confirmed: `Booking confirmed by ${counterpart.name}`,
    booking_declined: `Booking declined by ${counterpart.name}`,
    booking_cancelled_by_tech: `${counterpart.name} cancelled this booking`,
    booking_revision: `${counterpart.name} updated your booking request`,
    booking_revision_response: `${counterpart.name} responded to the revised booking`,
    appointment_started: `Appointment with ${counterpart.name} started`,
    booking_payment_captured: `Appointment with ${counterpart.name} complete`,
    payout_pending: `Payout pending for ${counterpart.name}'s appointment`,
    payment_due: `Payment needed for your appointment with ${counterpart.name}`,
    issue_resolved: `Appointment issue resolved for ${counterpart.name}`,
    tip_received: `${counterpart.name} added a tip`,
    payout_released: `Payout released for ${counterpart.name}'s appointment`,
  };

  return {
    title: titleOverrides[notification.type] || notification.title,
    body: notification.body ? `${serviceSummary} · ${notification.body}` : serviceSummary,
    destination,
    actionLabel: notification.type === "booking_revision" ? "Review update" : "View appointment",
    details,
  };
}

export function filterVisibleLastMinuteNotifications<T extends NotificationLike>(
  notifications: T[],
  activeSlotIds: Set<number>,
): T[] {
  return notifications.filter((notification) =>
    notification.type !== "last_minute_slot" ||
    (notification.relatedId !== null && activeSlotIds.has(notification.relatedId)),
  );
}
