import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { releaseEligiblePayouts } from "./payoutRelease";

export async function handlePayoutRelease(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await releaseEligiblePayouts();
    return res.json({ ok: true, ...result, taskUid: user.taskUid });
  } catch (error) {
    console.error("[Payout release] Scheduled handler failed", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Payout release failed.",
      timestamp: new Date().toISOString(),
    });
  }
}
