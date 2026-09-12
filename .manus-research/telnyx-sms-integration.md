# Telnyx SMS integration research

Telnyx messaging profiles group messaging phone numbers, webhook URLs, delivery configuration, and optional spend limits. Every messaging phone number must be assigned to a messaging profile. For Valisse, use a transactional profile with a daily spend limit, smart encoding, a primary webhook, and a failover webhook. Source: https://developers.telnyx.com/docs/messaging/messages/messaging-profiles-overview

Telnyx sends real-time `message.received`, `message.sent`, and `message.finalized` webhooks. The receiving endpoint should return a 2xx response within two seconds. Production webhook requests are signed with Ed25519 using `telnyx-signature-ed25519` and `telnyx-timestamp`; validate the signature against Telnyx’s public key and reject timestamps older than five minutes. Source: https://developers.telnyx.com/docs/messaging/messages/receiving-webhooks

For U.S. long-code A2P delivery, Telnyx documents a brand → vetting → campaign → number-assignment workflow. Valisse should register a transactional mixed or account-notification campaign with realistic sample messages, an accurate opt-in description, and STOP/HELP language before production traffic. Source: https://developers.telnyx.com/docs/messaging/10dlc/quickstart
