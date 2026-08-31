import { describe, expect, it } from "vitest";
import {
  getConversationPartnerId,
  getDirectMessageValidationError,
  isConversationParticipant,
  canExchangeDirectMessages,
  isSafeDirectMessageImageReference,
} from "../shared/directMessaging";

const conversation = { clientId: 101, techId: 202 };

describe("direct message participant isolation", () => {
  it("only allows the client or tech to access a conversation", () => {
    expect(isConversationParticipant(conversation, 101)).toBe(true);
    expect(isConversationParticipant(conversation, 202)).toBe(true);
    expect(isConversationParticipant(conversation, 303)).toBe(false);
  });

  it("never reveals a partner for a non-participant", () => {
    expect(getConversationPartnerId(conversation, 101)).toBe(202);
    expect(getConversationPartnerId(conversation, 202)).toBe(101);
    expect(getConversationPartnerId(conversation, 303)).toBeNull();
  });
});

describe("direct message validation", () => {
  it("accepts a text-only or photo-only message", () => {
    expect(getDirectMessageValidationError({ content: "Can you do a short almond set?", type: "text" })).toBeNull();
    expect(getDirectMessageValidationError({ imageUrl: "/manus-storage/messages/101/look.jpg", type: "image" })).toBeNull();
  });

  it("rejects empty, oversized, and image-less photo messages", () => {
    expect(getDirectMessageValidationError({ type: "text" })).toBe("A message or image is required.");
    expect(getDirectMessageValidationError({ content: "x".repeat(2_001), type: "text" })).toBe("Messages must be 2,000 characters or shorter.");
    expect(getDirectMessageValidationError({ content: "Sending a photo", type: "image" })).toBe("An image is required for image messages.");
  });
});

describe("direct message block protection", () => {
  it("does not permit messaging when either account has blocked the other", () => {
    expect(canExchangeDirectMessages(false)).toBe(true);
    expect(canExchangeDirectMessages(true)).toBe(false);
  });
});

describe("direct message image references", () => {
  it("only accepts an attachment uploaded to the sender's private message path", () => {
    expect(isSafeDirectMessageImageReference("/manus-storage/messages/101/look.jpg", 101)).toBe(true);
    expect(isSafeDirectMessageImageReference("/manus-storage/messages/202/look.jpg", 101)).toBe(false);
    expect(isSafeDirectMessageImageReference("https://tracking.example/look.jpg", 101)).toBe(false);
  });
});
