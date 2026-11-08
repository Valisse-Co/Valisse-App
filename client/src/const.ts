export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { encodeOAuthState, OAUTH_STATE_COOKIES, OAUTH_STATE_TTL_SECONDS } from "@shared/oauthState";

export type OAuthIntent = "login" | "signup";

// Generate login URL at runtime so redirect URI reflects the current origin.
// The intent is stored only in a short-lived, same-site cookie so the callback
// can distinguish a deliberate Google signup from a returning-user login.
export const getLoginUrl = (intent: OAuthIntent = "login") => {
  document.cookie = `valisse_oauth_intent=${intent}; Path=/; Max-Age=600; SameSite=Lax`;
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIES.manus}=${nonce}; Path=/; Max-Age=${OAUTH_STATE_TTL_SECONDS}; SameSite=None; Secure`;
  const state = encodeOAuthState({ provider: "manus", nonce, redirectUri });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
