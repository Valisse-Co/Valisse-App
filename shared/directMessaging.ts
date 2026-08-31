export type ConversationParticipants = {
  clientId: number;
  techId: number;
};

export function isConversationParticipant(conversation: ConversationParticipants, userId: number) {
  return conversation.clientId === userId || conversation.techId === userId;
}

export function getConversationPartnerId(
  conversation: ConversationParticipants,
  currentUserId: number,
) {
  if (!isConversationParticipant(conversation, currentUserId)) return null;
  return conversation.clientId === currentUserId ? conversation.techId : conversation.clientId;
}

export function getDirectMessageValidationError(input: {
  content?: string | null;
  imageUrl?: string | null;
  type: "text" | "image" | "booking_request" | "booking_card";
}) {
  const content = input.content?.trim() ?? "";
  if (!content && !input.imageUrl) return "A message or image is required.";
  if (content.length > 2_000) return "Messages must be 2,000 characters or shorter.";
  if (input.type === "image" && !input.imageUrl) return "An image is required for image messages.";
  return null;
}

export function canExchangeDirectMessages(isBlocked: boolean) {
  return !isBlocked;
}

export function isSafeDirectMessageImageReference(imageUrl: string, senderId: number) {
  return imageUrl.startsWith(`/manus-storage/messages/${senderId}/`);
}
