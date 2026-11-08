import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ user: vi.fn(), post: vi.fn(), privacy: vi.fn(), relationship: vi.fn(), views: vi.fn() }));
vi.mock("./db", async original => ({
  ...await original<object>(), getUserById: mock.user, getPostById: mock.post,
  getPrivacySettings: mock.privacy, hasAppointmentRelationship: mock.relationship,
  incrementPostViews: mock.views, getFollowerCount: vi.fn(async () => 2),
  getTechRatingStats: vi.fn(async () => ({ averageRating: 5, count: 1 })),
}));
import { appRouter } from "./routers";
const target = { id: 40, userType: "nail_tech", hasDualRole: true, name: "Synthetic Tech", businessName: "Synthetic Studio", avatarUrl: null, bio: "Public bio", services: ["Gel"], priceRange: "$40–60", addressCity: "Public City", addressState: "CA", fuzzedLat: 33.3, fuzzedLng: -117.1, lat: 33.12345, lng: -117.12345, passwordHash: "private-hash", email: "private-email", phone: "private-phone", fullAddress: "private-address", addressLine1: "private-street", stripeCustomerId: "private-stripe", openId: "private-openid", deactivatedAt: null };
const caller = (user: any = null) => appRouter.createCaller({ user, req: { headers: {} } as any, res: {} as any });
const assertSafe = (user: object) => {
  for (const key of ["passwordHash", "email", "phone", "fullAddress", "lat", "lng", "addressLine1", "stripeCustomerId", "openId"]) expect(user).not.toHaveProperty(key);
};
beforeEach(() => { vi.clearAllMocks(); mock.user.mockResolvedValue(target); mock.post.mockResolvedValue({ id: 7, techId: target.id, status: "published" }); mock.privacy.mockResolvedValue({ hideApproxLocation: false }); mock.relationship.mockResolvedValue(false); });
describe("public profile and post-detail privacy", () => {
  it("never serializes technician secrets in an anonymous post detail", async () => {
    const result = await caller().posts.getById({ postId: 7 });
    expect(result.tech).toMatchObject({ id: 40, name: target.name, businessName: target.businessName, location: "Public City, CA" });
    assertSafe(result.tech!);
  });
  it("respects hidden approximate location in both public entry points", async () => {
    mock.privacy.mockResolvedValue({ hideApproxLocation: true });
    const profile = await caller().users.getProfile({ userId: 40 });
    const post = await caller().posts.getById({ postId: 7 });
    for (const user of [profile.user, post.tech!]) {
      expect(user.fuzzedLat).toBeNull(); expect(user.fuzzedLng).toBeNull(); assertSafe(user);
    }
  });
  it("keeps client profiles private unless the viewer is their appointment-linked tech", async () => {
    mock.user.mockResolvedValue({ ...target, id: 41, userType: "client", hasDualRole: false });
    await expect(caller().users.getProfile({ userId: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ id: 50, userType: "nail_tech" }).users.getProfile({ userId: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    mock.relationship.mockResolvedValue(true);
    const result = await caller({ id: 50, userType: "nail_tech" }).users.getProfile({ userId: 41 });
    assertSafe(result.user); expect(result.user.location).toBeNull();
  });
  it.each(["hidden", "archived", "draft"])("does not disclose an unpublished %s post anonymously", async status => {
    mock.post.mockResolvedValue({ id: 7, techId: 40, status });
    await expect(caller().posts.getById({ postId: 7 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mock.views).not.toHaveBeenCalled();
  });
  it("preserves an author preview without returning their authentication secrets", async () => {
    mock.post.mockResolvedValue({ id: 7, techId: 40, status: "hidden" });
    const result = await caller({ id: 40 }).posts.getById({ postId: 7 });
    expect(result.post.status).toBe("hidden"); assertSafe(result.tech!);
  });
  it("does not disclose deactivated profiles or their posts to anonymous users", async () => {
    mock.user.mockResolvedValue({ ...target, deactivatedAt: new Date() });
    await expect(caller().users.getProfile({ userId: 40 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller().posts.getById({ postId: 7 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
