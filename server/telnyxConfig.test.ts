import { describe, expect, test } from "vitest";

const apiKey = process.env.TELNYX_API_KEY;
const profileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
const senderNumber = process.env.TELNYX_SENDER_NUMBER;
const publicKey = process.env.TELNYX_PUBLIC_KEY;

describe("Telnyx configuration", () => {
  test(
    "validates the configured transactional messaging profile", 
    async () => {
      expect(apiKey, "TELNYX_API_KEY must be configured").toMatch(/^KEY[A-Za-z0-9_-]+$/);
      expect(profileId, "TELNYX_MESSAGING_PROFILE_ID must be configured").toMatch(/^[A-Za-z0-9-]+$/);
      expect(senderNumber, "TELNYX_SENDER_NUMBER must use E.164 format").toMatch(/^\+[1-9]\d{7,14}$/);
      expect(publicKey, "TELNYX_PUBLIC_KEY must be configured").toMatch(/^[A-Za-z0-9_+/=-]+$/);

      const response = await fetch(`https://api.telnyx.com/v2/messaging_profiles/${profileId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      expect(response.ok, `Telnyx profile health check failed with HTTP ${response.status}`).toBe(true);
      const payload = await response.json() as { data?: { id?: string } };
      expect(payload.data?.id).toBe(profileId);
    },
    15_000,
  );
});
