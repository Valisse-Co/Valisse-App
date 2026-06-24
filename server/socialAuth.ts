/**
 * Social Auth — Google Sign In & Apple Sign In
 *
 * Both providers are credential-gated: if the required env vars are absent the
 * /start routes return 503 so the frontend can show a "Coming Soon" state
 * without crashing.  When credentials are supplied the full OAuth 2.0 / OIDC
 * flow runs and issues the same session cookie used by Manus OAuth.
 *
 * Environment variables required:
 *   Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   Apple:  APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
 */

import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";

// ─── Helpers ────────────────────────────────────────────────────────────────

function googleEnabled(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function appleEnabled(): boolean {
  return !!(
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY
  );
}

/** Issue a Valisse session cookie and redirect to the app. */
async function issueSession(
  req: Request,
  res: Response,
  opts: { openId: string; name: string | null; email: string | null; provider: string }
) {
  await db.upsertUser({
    openId: opts.openId,
    name: opts.name ?? null,
    email: opts.email ?? null,
    loginMethod: opts.provider,
    lastSignedIn: new Date(),
  });

  const sessionToken = await sdk.createSessionToken(opts.openId, {
    name: opts.name || "",
    expiresInMs: ONE_YEAR_MS,
  });

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
  res.redirect(302, "/");
}

// ─── Google ──────────────────────────────────────────────────────────────────

async function registerGoogleRoutes(app: Express) {
  const { OAuth2Client } = await import("google-auth-library");

  app.get("/api/oauth/google/start", (req: Request, res: Response) => {
    if (!googleEnabled()) {
      res.status(503).json({ error: "Google Sign In is not yet configured." });
      return;
    }

    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${req.query.origin ?? `${req.protocol}://${req.get("host")}`}/api/oauth/google/callback`
    );

    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "email", "profile"],
      state: String(req.query.origin ?? ""),
    });

    res.redirect(302, url);
  });

  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    if (!googleEnabled()) {
      res.status(503).json({ error: "Google Sign In is not yet configured." });
      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : null;
    const origin = typeof req.query.state === "string" ? req.query.state : null;

    if (!code) {
      res.status(400).json({ error: "Missing code from Google." });
      return;
    }

    try {
      const redirectUri = `${origin ?? `${req.protocol}://${req.get("host")}`}/api/oauth/google/callback`;
      const client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const { tokens } = await client.getToken(code);
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload?.sub) {
        res.status(400).json({ error: "Invalid Google token payload." });
        return;
      }

      await issueSession(req, res, {
        openId: `google_${payload.sub}`,
        name: payload.name ?? null,
        email: payload.email ?? null,
        provider: "google",
      });
    } catch (err) {
      console.error("[Google OAuth] Callback error:", err);
      res.redirect(302, "/login?error=google_failed");
    }
  });
}

// ─── Apple ───────────────────────────────────────────────────────────────────

async function registerAppleRoutes(app: Express) {
  const appleSignin = (await import("apple-signin-auth")).default;

  app.get("/api/oauth/apple/start", (req: Request, res: Response) => {
    if (!appleEnabled()) {
      res.status(503).json({ error: "Apple Sign In is not yet configured." });
      return;
    }

    const origin = String(req.query.origin ?? `${req.protocol}://${req.get("host")}`);
    const redirectUri = `${origin}/api/oauth/apple/callback`;

    const url = appleSignin.getAuthorizationUrl({
      clientID: process.env.APPLE_CLIENT_ID!,
      redirectUri,
      responseMode: "form_post",
      scope: "name email",
      state: origin,
    });

    res.redirect(302, url);
  });

  // Apple uses POST for its callback (form_post response mode)
  app.post("/api/oauth/apple/callback", async (req: Request, res: Response) => {
    if (!appleEnabled()) {
      res.status(503).json({ error: "Apple Sign In is not yet configured." });
      return;
    }

    const { code, id_token, state, user: userJson } = req.body as {
      code?: string;
      id_token?: string;
      state?: string;
      user?: string;
    };

    if (!code || !id_token) {
      res.redirect(302, "/login?error=apple_failed");
      return;
    }

    try {
      const clientSecret = appleSignin.getClientSecret({
        clientID: process.env.APPLE_CLIENT_ID!,
        teamID: process.env.APPLE_TEAM_ID!,
        keyIdentifier: process.env.APPLE_KEY_ID!,
        privateKey: process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      });

      const origin = state ?? `${req.protocol}://${req.get("host")}`;
      const redirectUri = `${origin}/api/oauth/apple/callback`;

      const tokenResponse = await appleSignin.getAuthorizationToken(code, {
        clientID: process.env.APPLE_CLIENT_ID!,
        redirectUri,
        clientSecret,
      });

      const idTokenClaims = await appleSignin.verifyIdToken(
        tokenResponse.id_token,
        { audience: process.env.APPLE_CLIENT_ID! }
      );

      // Apple only sends name on first sign-in; parse from user JSON if present
      let name: string | null = null;
      if (userJson) {
        try {
          const parsed = JSON.parse(userJson);
          const fn = parsed?.name?.firstName ?? "";
          const ln = parsed?.name?.lastName ?? "";
          name = [fn, ln].filter(Boolean).join(" ") || null;
        } catch {
          // ignore parse errors
        }
      }

      await issueSession(req, res, {
        openId: `apple_${idTokenClaims.sub}`,
        name,
        email: idTokenClaims.email ?? null,
        provider: "apple",
      });
    } catch (err) {
      console.error("[Apple OAuth] Callback error:", err);
      res.redirect(302, "/login?error=apple_failed");
    }
  });
}

// ─── Registration ────────────────────────────────────────────────────────────

export async function registerSocialAuthRoutes(app: Express) {
  await registerGoogleRoutes(app);
  await registerAppleRoutes(app);
}

/**
 * Returns the enabled state of each provider so the frontend can read it
 * via a single lightweight endpoint without exposing credentials.
 */
export function registerSocialAuthStatusRoute(app: Express) {
  app.get("/api/oauth/social-status", (_req: Request, res: Response) => {
    res.json({
      google: googleEnabled(),
      apple: appleEnabled(),
    });
  });
}
