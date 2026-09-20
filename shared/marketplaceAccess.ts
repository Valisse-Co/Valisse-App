export type MarketplaceRole = "client" | "nail_tech";

export type MarketplaceAccount = {
  id: number;
  userType: MarketplaceRole;
  hasDualRole?: boolean | null;
};

export type RoleAwareBooking = {
  clientId: number;
  techId: number;
};

export type RoleAwareConversation = {
  clientId: number;
  techId: number;
  clientRole?: MarketplaceRole | null;
  techRole?: MarketplaceRole | null;
};

export function isTechCapable(account: Pick<MarketplaceAccount, "userType" | "hasDualRole">) {
  return account.userType === "nail_tech" || Boolean(account.hasDualRole);
}

export function canDiscoverAccount(params: {
  viewer: MarketplaceAccount;
  target: MarketplaceAccount;
  hasAppointmentRelationship: boolean;
}) {
  if (params.viewer.id === params.target.id) return false;
  if (isTechCapable(params.target)) return true;
  return isTechCapable(params.viewer) && params.hasAppointmentRelationship;
}

export function getBookingRole(booking: RoleAwareBooking, userId: number): MarketplaceRole | null {
  if (booking.techId === userId) return "nail_tech";
  if (booking.clientId === userId) return "client";
  return null;
}

export function getConversationRole(
  conversation: RoleAwareConversation,
  userId: number,
): MarketplaceRole | null {
  if (conversation.clientId === userId) return conversation.clientRole ?? "client";
  if (conversation.techId === userId) return conversation.techRole ?? "nail_tech";
  return null;
}

export function getConversationPartner(
  conversation: RoleAwareConversation,
  userId: number,
): { userId: number; role: MarketplaceRole } | null {
  if (conversation.clientId === userId) {
    return { userId: conversation.techId, role: conversation.techRole ?? "nail_tech" };
  }
  if (conversation.techId === userId) {
    return { userId: conversation.clientId, role: conversation.clientRole ?? "client" };
  }
  return null;
}
