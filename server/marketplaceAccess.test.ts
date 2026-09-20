import { describe, expect, it } from "vitest";
import {
  canDiscoverAccount,
  getBookingRole,
  getConversationPartner,
  getConversationRole,
  isTechCapable,
} from "../shared/marketplaceAccess";

const client = { id: 1, userType: "client" as const, hasDualRole: false };
const dualTech = { id: 2, userType: "nail_tech" as const, hasDualRole: true };
const tech = { id: 3, userType: "nail_tech" as const, hasDualRole: false };

 describe("marketplace account capabilities", () => {
  it("keeps technician discovery available regardless of the viewer's active UI mode", () => {
    expect(isTechCapable(dualTech)).toBe(true);
    expect(canDiscoverAccount({ viewer: client, target: tech, hasAppointmentRelationship: false })).toBe(true);
    expect(canDiscoverAccount({ viewer: dualTech, target: tech, hasAppointmentRelationship: false })).toBe(true);
  });

  it("exposes a client profile only to an appointment-linked technician", () => {
    expect(canDiscoverAccount({ viewer: dualTech, target: client, hasAppointmentRelationship: true })).toBe(true);
    expect(canDiscoverAccount({ viewer: dualTech, target: client, hasAppointmentRelationship: false })).toBe(false);
    expect(canDiscoverAccount({ viewer: client, target: { ...client, id: 4 }, hasAppointmentRelationship: true })).toBe(false);
  });

  it("labels each booking from the current user's stored role", () => {
    const booking = { clientId: 2, techId: 3 };
    expect(getBookingRole(booking, 2)).toBe("client");
    expect(getBookingRole(booking, 3)).toBe("nail_tech");
    expect(getBookingRole(booking, 99)).toBeNull();
  });
});

describe("role-aware direct messages", () => {
  const conversation = { clientId: 2, techId: 3, clientRole: "nail_tech" as const, techRole: "nail_tech" as const };

  it("resolves the same partner without consulting mutable active mode", () => {
    expect(getConversationPartner(conversation, 2)).toEqual({ userId: 3, role: "nail_tech" });
    expect(getConversationPartner(conversation, 3)).toEqual({ userId: 2, role: "nail_tech" });
  });

  it("preserves the role context stored on the thread", () => {
    expect(getConversationRole(conversation, 2)).toBe("nail_tech");
    expect(getConversationRole(conversation, 3)).toBe("nail_tech");
  });
});
