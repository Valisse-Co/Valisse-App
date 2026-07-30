import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // ── Duplicate-email guard ──────────────────────────────────────────────
      // If this email is already registered with an email+password account
      // (different openId), block the Google sign-in and redirect to login.
      if (userInfo.email) {
        const existingByEmail = await db.getUserByEmail(userInfo.email.toLowerCase());
        if (
          existingByEmail &&
          existingByEmail.openId !== userInfo.openId &&
          existingByEmail.loginMethod === "email"
        ) {
          res.redirect(
            302,
            `/login?error=email_exists&email=${encodeURIComponent(userInfo.email)}`
          );
          return;
        }
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ? userInfo.email.toLowerCase() : null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? "google",
        lastSignedIn: new Date(),
      });

      // Fetch the user row to determine post-login routing
      const user = await db.getUserByOpenId(userInfo.openId);

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Route returning (already-onboarded) users directly to their home screen.
      // New users go to onboarding to choose their role and complete their profile.
      if (user && user.onboardingCompleted) {
        const effectiveMode = user.hasDualRole ? user.activeMode : user.userType;
        if (effectiveMode === "nail_tech") {
          res.redirect(302, "/dashboard");
        } else {
          res.redirect(302, "/discover");
        }
      } else {
        res.redirect(302, "/onboarding");
      }
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
