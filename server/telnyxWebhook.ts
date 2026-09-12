import type { Request, Response } from "express";
import { revokeSmsConsentForPhoneCandidates } from "./db";
import { isHelpKeyword, isStopKeyword, phoneLookupCandidates, sendValisseTransactionalSms, verifyTelnyxWebhook } from "./telnyx";

type TelnyxEvent = {
  data?: {
    id?: string;
    event_type?: string;
    payload?: { from?: { phone_number?: string }; text?: string; id?: string; to?: Array<{ status?: string }> };
  };
};

export async function handleTelnyxWebhook(req: Request, res: Response) {
  const signature = typeof req.headers["telnyx-signature-ed25519"] === "string" ? req.headers["telnyx-signature-ed25519"] : undefined;
  const timestamp = typeof req.headers["telnyx-timestamp"] === "string" ? req.headers["telnyx-timestamp"] : undefined;
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  if (!verifyTelnyxWebhook(rawBody, signature, timestamp)) return res.status(403).json({ error: "Invalid Telnyx webhook signature." });

  const event = JSON.parse(rawBody.toString("utf8")) as TelnyxEvent;
  const payload = event.data?.payload;
  if (event.data?.event_type === "message.received" && payload?.from?.phone_number) {
    const candidates = phoneLookupCandidates(payload.from.phone_number);
    if (isStopKeyword(payload.text)) {
      const affected = await revokeSmsConsentForPhoneCandidates(candidates);
      console.info("[Telnyx webhook] Processed STOP", { eventId: event.data.id, affected });
    }
    if (isHelpKeyword(payload.text)) {
      // A HELP response is itself transactional and is sent only when the sender belongs to a consenting Valisse account.
      const { getUsersByPhoneCandidates } = await import("./db");
      const [user] = await getUsersByPhoneCandidates(candidates);
      if (user?.smsConsent) {
        await sendValisseTransactionalSms({
          userId: user.id,
          category: "help",
          text: "Valisse help: booking and appointment updates. Reply STOP to opt out. Contact support@valisseco.com for assistance.",
        });
      }
    }
  }
  console.info("[Telnyx webhook] Processed", event.data?.event_type, event.data?.id);
  return res.json({ received: true });
}
