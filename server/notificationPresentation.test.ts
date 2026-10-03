import { describe, expect, it } from "vitest";
import {
  filterVisibleLastMinuteNotifications,
  getNotificationDestination,
  presentNotification,
} from "../shared/notificationPresentation";

const booking = {
  bookingId: 91,
  clientId: 7,
  techId: 12,
  clientName: "Alex Rivera",
  techName: "Nails by Jane",
  serviceName: "Gel Manicure",
  durationMinutes: 75,
  issueReason: "The service was not completed as agreed.",
  recipientId: 12,
  recipientRole: "user" as const,
};

describe("notification presentation", () => {
  it("removes expired last-minute alerts while preserving all other notifications", () => {
    const visible = filterVisibleLastMinuteNotifications([
      { type: "last_minute_slot", title: "Expired", body: null, relatedId: 1 },
      { type: "last_minute_slot", title: "Active", body: null, relatedId: 2 },
      { type: "new_post", title: "New look", body: null, relatedId: 3 },
    ], new Set([2]));

    expect(visible.map((notification) => notification.title)).toEqual(["Active", "New look"]);
  });

  it("enriches a technician booking request with client, service, and duration", () => {
    const presentation = presentNotification({
      type: "new_booking",
      title: "New Booking Request",
      body: "A client requested a booking",
      relatedId: 91,
    }, booking);

    expect(presentation).toMatchObject({
      title: "New booking request from Alex Rivera",
      body: "Gel Manicure · 75 min · Review the request and respond.",
      destination: "/tech-bookings?bookingId=91",
      actionLabel: "Review booking",
    });
  });

  it("shows the reported reason and opens the administrator issue review", () => {
    const presentation = presentNotification({
      type: "booking_issue_reported",
      title: "Booking issue reported",
      body: "A client reported an issue",
      relatedId: 91,
    }, { ...booking, recipientId: 1, recipientRole: "admin" });

    expect(presentation.title).toBe("Appointment issue: Alex Rivera and Nails by Jane");
    expect(presentation.body).toContain("The service was not completed as agreed.");
    expect(presentation.destination).toBe("/admin/reports?bookingId=91");
  });

  it("routes a client to their booking and an opening to its booking flow", () => {
    expect(getNotificationDestination({ type: "last_minute_slot", title: "Opening", body: null, relatedId: 44 })).toBe("/book-last-minute/44");
    expect(getNotificationDestination({ type: "booking_confirmed", title: "Confirmed", body: null, relatedId: 91 }, { ...booking, recipientId: 7 })).toBe("/bookings?bookingId=91");
  });
});
