/**
 * Demo login routes — development/demo use only.
 * Provides /api/demo-login/nail-tech and /api/demo-login/client
 * that issue a valid session cookie without going through OAuth.
 *
 * These routes are intentionally unrestricted so you can open them
 * in any browser tab to instantly switch demo accounts.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

// Fixed openIds for the two demo accounts
const DEMO_NAIL_TECH_OPEN_ID = "bebQ2xBqBDC6SUTQxLcmKb"; // Ashton Earl (id=1)
const DEMO_CLIENT_OPEN_ID = "demo_client_valisse";        // Alex Rivera

async function issueSessionFor(
  openId: string,
  name: string,
  req: Request,
  res: Response
) {
  const user = await db.getUserByOpenId(openId);
  if (!user) {
    res.status(404).json({ error: `Demo user not found (openId: ${openId})` });
    return;
  }

  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: ONE_YEAR_MS,
  });

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

  // Redirect to the appropriate landing page based on userType
  const destination = user.userType === "nail_tech" ? "/dashboard" : "/discover";
  res.redirect(302, destination);
}

export function registerDemoLoginRoutes(app: Express) {
  // Log in as the demo nail tech (Ashton Earl)
  app.get("/api/demo-login/nail-tech", async (req: Request, res: Response) => {
    await issueSessionFor(DEMO_NAIL_TECH_OPEN_ID, "Ashton Earl", req, res);
  });

  // Log in as the demo client (Alex Rivera)
  app.get("/api/demo-login/client", async (req: Request, res: Response) => {
    await issueSessionFor(DEMO_CLIENT_OPEN_ID, "Alex Rivera", req, res);
  });
}
