import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getCookie(req: Request, key: string): string | undefined {
  const raw = req.headers.cookie ?? "";
  return raw
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${key}=`))
    ?.slice(key.length + 1);
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

      const oauthIntent = getCookie(req, "valisse_oauth_intent") === "signup" ? "signup" : "login";
      const existingByOpenId = await db.getUserByOpenId(userInfo.openId);

      // ── Duplicate-email guard ──────────────────────────────────────────────
      // A Valisse email belongs to exactly one identity. Never let a different
      // external identity overwrite or duplicate an existing account.
      if (userInfo.email) {
        const existingByEmail = await db.getUserByEmail(userInfo.email.toLowerCase());
        if (
          existingByEmail &&
          existingByEmail.openId !== userInfo.openId
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
      res.clearCookie("valisse_oauth_intent", { ...cookieOptions, maxAge: -1 });

      // Route returning (already-onboarded) users directly to their home screen.
      if (user && user.onboardingCompleted) {
        const effectiveMode = user.hasDualRole ? user.activeMode : user.userType;
        if (effectiveMode === "nail_tech") {
          res.redirect(302, "/dashboard");
        } else {
          res.redirect(302, "/discover");
        }
      } else {
        // New and incomplete social accounts explicitly confirm the selected
        // Google identity before role-selection onboarding begins.
        const email = user?.email ?? userInfo.email ?? "";
        const source = existingByOpenId || oauthIntent === "signup" ? "signup" : "login";
        res.redirect(302, `/signup/google-confirm?email=${encodeURIComponent(email)}&source=${source}`);
      }
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
