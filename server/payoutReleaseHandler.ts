import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { releaseEligiblePayouts } from "./payoutRelease";
import { sendDueAppointmentCodeSms } from "./appointmentSms";
import { evaluateAttendanceFeeEligibility } from "./appointmentFees";

export async function handlePayoutRelease(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const [payouts, appointmentCodes, attendanceFees] = await Promise.all([
      releaseEligiblePayouts(),
      sendDueAppointmentCodeSms(),
      evaluateAttendanceFeeEligibility(),
    ]);
    return res.json({ ok: true, ...payouts, appointmentCodes, attendanceFees, taskUid: user.taskUid });
  } catch (error) {
    console.error("[Payout release] Scheduled handler failed", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Payout release failed.",
      timestamp: new Date().toISOString(),
    });
  }
}
