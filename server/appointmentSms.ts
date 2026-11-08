import { ENV } from "./_core/env";
import { getBookingsDueForAppointmentCodeSms, markAppointmentCodeSmsSent } from "./db";
import { deriveAppointmentCode } from "../shared/appointmentLifecycle";
import { sendValisseTransactionalSms } from "./telnyx";
import { safeErrorDetails } from "./securityLogging";

/** Idempotently sends the one-time appointment start code once it becomes visible. */
export async function sendDueAppointmentCodeSms(now = new Date(), maxItems = 5) {
  const limit = Number.isSafeInteger(maxItems) && maxItems > 0 ? Math.min(maxItems, 100) : 5;
  const dueBookings = (await getBookingsDueForAppointmentCodeSms(now, limit)).slice(0, limit);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const booking of dueBookings) {
    if (booking.isQaTest) { skipped += 1; continue; }
    try {
      const code = deriveAppointmentCode(booking.id, booking.scheduledAt, ENV.cookieSecret);
      const result = await sendValisseTransactionalSms({
        userId: booking.clientId,
        category: "appointment_code",
        text: `Valisse: your appointment start code is ${code}. Show it to your nail tech when your service begins. Reply STOP to opt out.`,
      });
      if (result.sent) {
        await markAppointmentCodeSmsSent(booking.id, now);
        sent += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      console.warn("[Appointment SMS] Code delivery failed", safeErrorDetails(error));
    }
  }
  return { found: dueBookings.length, sent, skipped, failed };
}
