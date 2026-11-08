import { randomBytes, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import type { Request, Response } from "express";
import { decodeOAuthState, encodeOAuthState, OAUTH_STATE_COOKIES, OAUTH_STATE_TTL_SECONDS, type OAuthProvider } from "../shared/oauthState";

const cookieOptions = { path: "/", secure: true, sameSite: "none" as const, httpOnly: true };
export function createBrowserOAuthState(res: Response, provider: OAuthProvider, redirectUri: string): string {
  const nonce = randomBytes(32).toString("base64url");
  const state = encodeOAuthState({ provider, nonce, redirectUri });
  res.cookie(OAUTH_STATE_COOKIES[provider], nonce, { ...cookieOptions, maxAge: OAUTH_STATE_TTL_SECONDS * 1000 });
  return state;
}
export function consumeBrowserOAuthState(req: Request, res: Response, raw: unknown, provider: OAuthProvider) {
  const state = decodeOAuthState(raw, provider);
  let expected: string | undefined;
  try { expected = parse(req.headers.cookie ?? "")[OAUTH_STATE_COOKIES[provider]]; } catch { return null; }
  if (!state || !expected || !/^[A-Za-z0-9_-]{32,64}$/.test(expected) || expected.length !== state.nonce.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(state.nonce))) return null;
  res.clearCookie(OAUTH_STATE_COOKIES[provider], cookieOptions);
  return state;
}
