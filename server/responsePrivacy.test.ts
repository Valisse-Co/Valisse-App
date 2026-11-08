import { getTableName } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Booking, BookingFeeEvent, User } from "../drizzle/schema";
import {
  PUBLIC_IDENTITY_FIELDS,
  PUBLIC_TECHNICIAN_FIELDS,
  toBookingCounterpart,
  toParticipantBooking,
  toParticipantFeeEvent,
  toPublicIdentity,
  toPublicTechnician,
} from "../shared/responsePrivacy";

// This adapter deliberately returns surplus fields so response projections, not
// just SELECT columns, are tested. No mysql connection can be created.
const mock = vi.hoisted(() => ({
  resolve: (_table: string, _selection: any): any[] => [],
  selections: [] as Array<{ table: string; selection: any }>,
}));
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    select: (selection?: any) => {
      let table = "";
      const chain: any = {
        from: (value: any) => { table = getTableName(value); return chain; },
        leftJoin: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        then: (resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) => {
          mock.selections.push({ table, selection });
          return Promise.resolve(mock.resolve(table, selection)).then(resolve, reject);
        },
      };
      return chain;
    },
  }),
}));

import {
  getAllUserBookings,
  getAlternativeTechs,
  getBookingById,
  getClientBookings,
  getDiscoverFeed,
  getDisputedBookingsForAdmin,
  getDisputedFeeEventsForAdmin,
  getOpenLastMinuteSlots,
  getSavedPostsForAlbum,
  getTechBookings,
  getTechBookingsTimeline,
  getTechnicianCalendar,
  getTechPastBookings,
  getTechPayoutHistory,
  getTechReviews,
  getTodayBookings,
  getUpcomingBookingsForUser,
  getUserSavedPosts,
  getUserById,
} from "./db";

const privateValues = [
  "SENTINEL_PASSWORD", "SENTINEL_EMAIL", "SENTINEL_PHONE", "SENTINEL_OPENID",
  "SENTINEL_STREET", "SENTINEL_POSTAL", "SENTINEL_STRIPE", "SENTINEL_CODE_HASH",
];
const user = {
  id: 20, name: "Artist Name", businessName: "Studio Name", avatarUrl: "/avatar.png",
  userType: "nail_tech", hasDualRole: true, bio: "Public artist bio", services: ["Gel"],
  priceRange: "$40–60", instagramHandle: "studio", yearsExperience: 5,
  smartMatchEnabled: true, addressCity: "Public City", addressState: "CA",
  fuzzedLat: 35.2, fuzzedLng: -119.1, fullAddress: "SENTINEL_FULL_ADDRESS",
  location: "SENTINEL_STREET", businessAddress: "SENTINEL_STREET",
  addressLine1: "SENTINEL_STREET", addressLine2: "SENTINEL_STREET",
  addressPostalCode: "SENTINEL_POSTAL", clientPostalCode: "SENTINEL_POSTAL",
  lat: 34.123456, lng: -118.123456, clientLat: 33.654321, clientLng: -117.654321,
  passwordHash: "SENTINEL_PASSWORD", email: "SENTINEL_EMAIL", phone: "SENTINEL_PHONE",
  openId: "SENTINEL_OPENID", stripeCustomerId: "SENTINEL_STRIPE",
  stripeConnectedAccountId: "SENTINEL_STRIPE", stripeTestConnectedAccountId: "SENTINEL_STRIPE",
  futurePrivateColumn: "SENTINEL_PASSWORD",
} as unknown as User;
const booking = {
  id: 7, clientId: 10, techId: 20, status: "confirmed", serviceType: "Gel",
  scheduledAt: new Date("2030-01-02T12:00:00Z"), createdAt: new Date("2029-12-01T00:00:00Z"),
  updatedAt: new Date("2029-12-01T00:00:00Z"), duration: 60, notes: "Client notes",
  techNotes: "Existing technician note", cancellationReason: "Keep the intentional cancellation reason",
  paymentMethodStatus: "saved", paymentStatus: "paid", payoutStatus: "on_hold",
  cancellationFeeAmount: 12.5, tipAmountInCents: 1500, refundAmountInCents: 2500,
  appointmentCodeHash: "SENTINEL_CODE_HASH", appointmentCodeFailures: 3,
  stripeSetupIntentId: "SENTINEL_STRIPE", stripePaymentIntentId: "SENTINEL_STRIPE",
  stripeTipPaymentIntentId: "SENTINEL_STRIPE", stripeTransferId: "SENTINEL_STRIPE",
  stripeRefundId: "SENTINEL_STRIPE", stripeTipRefundId: "SENTINEL_STRIPE",
  stripeCancellationPaymentIntentId: "SENTINEL_STRIPE",
  feePolicySnapshot: { amountInCents: 500, nested: [{ stripePaymentIntentId: "SENTINEL_STRIPE", phone: "SENTINEL_PHONE", graceMinutes: 15 }] },
  futurePrivateColumn: "SENTINEL_PASSWORD",
} as unknown as Booking;
const event = {
  id: 8, bookingId: 7, clientId: 10, techId: 20, feeType: "no_show", status: "disputed",
  amountInCents: 2500, payoutStatus: "on_hold", clientDisputeReason: "A preserved dispute reason",
  stripePaymentIntentId: "SENTINEL_STRIPE", stripeTransferId: "SENTINEL_STRIPE",
  stripeRefundId: "SENTINEL_STRIPE", policySnapshot: { amountInCents: 2500, nested: { passwordHash: "SENTINEL_PASSWORD" } },
} as unknown as BookingFeeEvent;
const client = { ...user, id: 10, name: "Client Name", userType: "client", hasDualRole: false } as User;
const addonService = { id: 9, customName: "Nail art", category: "Art", priceInCents: 500, durationMinutes: 15 };
const post = { id: 1, techId: user.id, style: null, shape: null, colors: [], color: null, createdAt: new Date(), status: "published", isPromoted: false, imageUrls: ["/post.png"] };

function expectPrivateFieldsAbsent(value: unknown, allowFullAddress = false) {
  if (Array.isArray(value)) return value.forEach((item) => expectPrivateFieldsAbsent(item, allowFullAddress));
  if (!value || typeof value !== "object" || value instanceof Date) return;
  for (const [key, item] of Object.entries(value)) {
    expect(key, `Private response key: ${key}`).not.toMatch(/^(?:stripe.*|passwordHash|appointmentCodeHash|appointmentCodeFailures|openId|sessionVersion|email|phone|lat|lng|clientLat|clientLng|businessAddress|addressLine1|addressLine2|addressPostalCode|clientPostalCode|futurePrivateColumn)$/i);
    if (key === "fullAddress" && !allowFullAddress) expect(item).toBeNull();
    if (typeof item === "string") {
      for (const sentinel of privateValues) expect(item).not.toContain(sentinel);
      if (!allowFullAddress) expect(item).not.toContain("SENTINEL_FULL_ADDRESS");
    }
    expectPrivateFieldsAbsent(item, allowFullAddress);
  }
}

beforeEach(() => {
  // A dummy value triggers only the mocked adapter even when the environment
  // already has production credentials. No network-capable adapter is loaded.
  vi.stubEnv("DATABASE_URL", "mock-only-no-network");
  mock.selections.length = 0;
  mock.resolve = () => [];
});
afterEach(() => vi.unstubAllEnvs());

describe("explicit response privacy contracts", () => {
  it("allowlists public identity, business information, and city/state without free-form addresses", () => {
    const identity = toPublicIdentity(user);
    const tech = toPublicTechnician(user);
    expect(Object.keys(identity).sort()).toEqual([...PUBLIC_IDENTITY_FIELDS].sort());
    expect(Object.keys(tech).sort()).toEqual([...PUBLIC_TECHNICIAN_FIELDS, "location"].sort());
    expect(tech).toMatchObject({ name: user.name, businessName: user.businessName, bio: user.bio, services: ["Gel"], location: "Public City, CA", fuzzedLat: user.fuzzedLat, fuzzedLng: user.fuzzedLng });
    expectPrivateFieldsAbsent({ identity, tech });
    expect(toPublicIdentity(null)).toBeNull();
    expect(toPublicTechnician(undefined)).toBeNull();
  });

  it("nulls approximate coordinates when hidden, but keeps direct referral profiles", () => {
    const tech = toPublicTechnician(user, { hideApproxLocation: true });
    expect(tech).toMatchObject({ id: 20, fuzzedLat: null, fuzzedLng: null, location: "Public City, CA" });
    const referralPrivacy = { discoverVisible: false, hideApproxLocation: false };
    expect(toPublicTechnician(user, referralPrivacy)?.id).toBe(user.id);
    expect(toPublicTechnician(client)).toMatchObject({ location: null, addressCity: null, addressState: null, fuzzedLat: null, fuzzedLng: null });
    expectPrivateFieldsAbsent(tech);
  });

  it("never substitutes exact coordinates or a free-form street label when public location is absent", () => {
    const tech = toPublicTechnician({ ...user, addressCity: null, addressState: null, fuzzedLat: null, fuzzedLng: null });
    expect(tech).toMatchObject({ location: null, fuzzedLat: null, fuzzedLng: null });
    expectPrivateFieldsAbsent(tech);
  });

  it("preserves appointment workflow, money, and reasons, but removes hashes/provider IDs recursively", () => {
    const safe = toParticipantBooking(booking);
    expect(safe).toMatchObject({ id: 7, status: "confirmed", scheduledAt: booking.scheduledAt, duration: 60, notes: booking.notes, techNotes: booking.techNotes, cancellationReason: booking.cancellationReason, paymentStatus: "paid", payoutStatus: "on_hold", tipAmountInCents: 1500, refundAmountInCents: 2500, cancellationFeeAmount: 12.5 });
    expect(safe.scheduledAt).toBeInstanceOf(Date);
    expect(safe.feePolicySnapshot).toEqual({ amountInCents: 500, nested: [{ graceMinutes: 15 }] });
    expectPrivateFieldsAbsent(safe);
    expectPrivateFieldsAbsent(toParticipantFeeEvent(event));
    expect(booking.appointmentCodeHash).toBe("SENTINEL_CODE_HASH");
    expect(user.passwordHash).toBe("SENTINEL_PASSWORD");
  });

  it.each(["pending", "in_progress", "completed", "cancelled", "declined", "disputed", "no_show", "payment_due"])("does not disclose the address for client booking status %s", (status) => {
    const safe = toBookingCounterpart(user, { ...booking, status: status as Booking["status"] }, "client");
    expect(safe?.fullAddress).toBeNull();
    expectPrivateFieldsAbsent(safe);
  });

  it("shares an address only for the confirmed client's matching technician", () => {
    const safe = toBookingCounterpart(user, booking, "client");
    expect(safe?.fullAddress).toBe("SENTINEL_FULL_ADDRESS");
    expectPrivateFieldsAbsent(safe, true);
    expect(toBookingCounterpart(user, booking, "nail_tech")?.fullAddress).toBeNull();
    expect(toBookingCounterpart(client, booking, "client")?.fullAddress).toBeNull();
    expect(toBookingCounterpart(null, booking, "client")).toBeNull();
  });
});

describe("database outward response privacy (mocked only)", () => {
  it("sanitizes administrator booking issues without losing party names", async () => {
    mock.resolve = (table) => table === "users" ? [user, client] : [booking];
    const rows = await getDisputedBookingsForAdmin();
    expect(rows[0]).toMatchObject({ id: 7, clientName: "Client Name", techName: "Studio Name" });
    expectPrivateFieldsAbsent(rows);
  });

  it("keeps payout summaries private while retaining their money calculations", async () => {
    mock.resolve = (table, selection) => table === "bookings" ? selection?.booking ? [{ booking, clientName: "Client Name" }] : [booking] : [];
    const rows = await getTechPayoutHistory(20);
    expect(rows[0]).toMatchObject({ clientName: "Client Name", booking: { id: 7, payoutStatus: "on_hold" } });
    expect(rows[0].amounts).toHaveProperty("payoutTotalInCents");
    expectPrivateFieldsAbsent(rows);
  });

  it("routes legacy saved-post lookups through the safe projection", async () => {
    mock.resolve = () => [{ savedPost: { id: 3 }, post, tech: user, privacy: null }];
    const rows = await getUserSavedPosts(10);
    expect(rows[0].tech?.name).toBe("Artist Name");
    expectPrivateFieldsAbsent(rows);
  });

  it("projects public reviewers", async () => {
    mock.resolve = () => [{ review: { id: 2, rating: 5, comment: "Great work" }, client }];
    const rows = await getTechReviews(20);
    expect(rows[0].client).toMatchObject({ id: 10, name: "Client Name", avatarUrl: "/avatar.png" });
    expectPrivateFieldsAbsent(rows);
    expect(Object.keys(mock.selections[0].selection.client).sort()).toEqual([...PUBLIC_IDENTITY_FIELDS].sort());
  });

  it.each([null, 4])("projects saved-post technicians for album %s and honors hidden approximate location", async (album) => {
    mock.resolve = () => [{ savedPost: { id: 3 }, post, tech: user, privacy: { hideApproxLocation: true } }];
    const rows = await getSavedPostsForAlbum(10, album);
    expect(rows[0].tech).toMatchObject({ businessName: "Studio Name", fuzzedLat: null, fuzzedLng: null });
    expect(rows[0].post).toBe(post);
    expectPrivateFieldsAbsent(rows);
  });

  it("projects public slots and excludes referral-only technicians", async () => {
    mock.resolve = () => [
      { slot: { id: 1, startTime: "10:00" }, tech: user, privacy: { discoverVisible: true, hideApproxLocation: true } },
      { slot: { id: 2 }, tech: user, privacy: { discoverVisible: false } },
    ];
    const rows = await getOpenLastMinuteSlots();
    expect(rows).toHaveLength(1);
    expect(rows[0].tech?.fuzzedLat).toBeNull();
    expectPrivateFieldsAbsent(rows);
  });

  it.each([
    { name: "getTechBookings", helper: getTechBookings },
    { name: "getTodayBookings", helper: getTodayBookings },
    { name: "getTechBookingsTimeline", helper: getTechBookingsTimeline },
    { name: "getTechPastBookings", helper: getTechPastBookings },
  ])("sanitizes technician booking helper $name", async ({ helper }) => {
    mock.resolve = () => [{ booking, client, addonService }];
    const rows = await helper(20);
    expect(rows[0].booking.cancellationReason).toBe(booking.cancellationReason);
    expect(rows[0].client?.name).toBe("Client Name");
    expectPrivateFieldsAbsent(rows);
  });

  it("gates addresses in the client booking helper", async () => {
    mock.resolve = () => [
      { booking, tech: user },
      { booking: { ...booking, id: 8, status: "pending" }, tech: user },
      { booking: { ...booking, id: 9, status: "cancelled" }, tech: user },
    ];
    const rows = await getClientBookings(10);
    expect(rows.map((row) => row.tech?.fullAddress)).toEqual(["SENTINEL_FULL_ADDRESS", null, null]);
    expectPrivateFieldsAbsent(rows, true);
  });

  it("retains role/account names and exact-address gating in combined dual-role bookings", async () => {
    mock.resolve = (table, selection) => table === "reviews" ? []
      : selection?.tech ? [{ booking, tech: user }]
      : [{ booking: { ...booking, id: 8, clientId: 30, techId: 10 }, client, addonService }];
    const rows = await getAllUserBookings(10);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.myRole === "client")?.counterpart).toMatchObject({ businessName: "Studio Name", userType: "nail_tech", hasDualRole: true, fullAddress: "SENTINEL_FULL_ADDRESS" });
    expect(rows.find((row) => row.myRole === "nail_tech")?.counterpart).toMatchObject({ name: "Client Name", fullAddress: null });
    expectPrivateFieldsAbsent(rows, true);
  });

  it("sanitizes calendar bookings while keeping the existing workspace structure", async () => {
    mock.resolve = (table, selection) => table === "users" && selection?.timeZone ? [{ timeZone: "UTC" }]
      : table === "bookings" ? [{ booking, client, addonService }] : [];
    const calendar = await getTechnicianCalendar(20, { fromLocalDate: "2030-01-01", toLocalDate: "2030-01-07" });
    expect(calendar.timeZone).toBe("UTC");
    expect(calendar.bookings[0].addonService).toBe(addonService);
    expectPrivateFieldsAbsent(calendar);
  });

  it("sanitizes upcoming bookings without removing fields used by account deactivation", async () => {
    mock.resolve = () => [booking];
    const rows = await getUpcomingBookingsForUser(10);
    expect(rows[0]).toMatchObject({ id: 7, clientId: 10, techId: 20, scheduledAt: booking.scheduledAt, createdAt: booking.createdAt });
    expectPrivateFieldsAbsent(rows);
  });

  it("sanitizes disputed fees, nested booking records, and client identities", async () => {
    mock.resolve = () => [{ event, booking, client }];
    const rows = await getDisputedFeeEventsForAdmin();
    expect(rows[0].event).toMatchObject({ amountInCents: 2500, clientDisputeReason: event.clientDisputeReason, status: "disputed", payoutStatus: "on_hold" });
    expectPrivateFieldsAbsent(rows);
  });

  it.each([false, true])("uses fuzzed coordinates for Discover scoring/sorting (nearestFirst=%s), excluding referrals and nulling hidden pins", async (nearestFirst) => {
    const nearFuzzed = { ...user, id: 21, lat: 50, lng: 50, fuzzedLat: 0, fuzzedLng: 0.01 };
    const farFuzzed = { ...user, id: 22, lat: 0, lng: 0, fuzzedLat: 30, fuzzedLng: 30 };
    mock.resolve = () => [
      { post: { ...post, id: 1 }, tech: farFuzzed, analytics: null, privacy: null },
      { post: { ...post, id: 2 }, tech: nearFuzzed, analytics: null, privacy: null },
      { post: { ...post, id: 3 }, tech: user, analytics: null, privacy: { discoverVisible: false } },
      { post: { ...post, id: 4 }, tech: user, analytics: null, privacy: { hideApproxLocation: true } },
    ];
    const rows = await getDiscoverFeed(20, 0, { userLat: 0, userLng: 0, distanceMiles: 10, nearestFirst });
    const content = rows.filter((row: any) => !row._divider);
    expect(content[0].post.id).toBe(2);
    expect(content.some((row: any) => row.post.id === 3)).toBe(false);
    expect(content.find((row: any) => row.post.id === 4)?.tech).toMatchObject({ fuzzedLat: null, fuzzedLng: null });
    expectPrivateFieldsAbsent(rows);
    const columns = mock.selections[0].selection.tech;
    expect(Object.keys(columns).sort()).toEqual([...PUBLIC_TECHNICIAN_FIELDS].sort());
    expect(columns).not.toHaveProperty("lat");
    expect(columns).not.toHaveProperty("lng");
  });

  it("computes alternative-tech distances only from fuzzed coordinates, never hidden or real locations", async () => {
    const near = { ...user, id: 21, lat: 50, lng: 50, fuzzedLat: 0, fuzzedLng: 0, discoverVisible: true };
    const far = { ...user, id: 22, lat: 0, lng: 0, fuzzedLat: 30, fuzzedLng: 30, discoverVisible: true };
    const hidden = { ...user, id: 23, hideApproxLocation: true };
    const referral = { ...user, id: 24, discoverVisible: false };
    mock.resolve = (table) => table === "users" ? [far, near, hidden, referral]
      : [{ techId: 21, dayOfWeek: 3 }, { techId: 22, dayOfWeek: 3 }, { techId: 23, dayOfWeek: 3 }, { techId: 24, dayOfWeek: 3 }];
    const rows = await getAlternativeTechs({ originalTechId: 20, serviceType: "Gel", scheduledAt: new Date("2030-01-02T12:00:00Z"), clientLat: 0, clientLng: 0 });
    expect(rows.map((row) => row.id)).toEqual([21, 22, 23]);
    expect(rows[0].distanceMiles).toBe(0);
    expect(rows[1].distanceMiles).toBeGreaterThan(100);
    expect(rows[2]).toMatchObject({ distanceMiles: null, fuzzedLat: null, fuzzedLng: null });
    expectPrivateFieldsAbsent(rows);
    expect(Object.keys(mock.selections[0].selection).sort()).toEqual([...PUBLIC_TECHNICIAN_FIELDS, "discoverVisible", "hideApproxLocation"].sort());
  });

  it("leaves server-only user and payment/appointment queries unmodified", async () => {
    mock.resolve = (table) => table === "users" ? [user] : [booking];
    expect((await getUserById(20))?.passwordHash).toBe("SENTINEL_PASSWORD");
    expect((await getBookingById(7))?.stripePaymentIntentId).toBe("SENTINEL_STRIPE");
    expect((await getBookingById(7))?.appointmentCodeHash).toBe("SENTINEL_CODE_HASH");
  });
});
