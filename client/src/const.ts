export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export type OAuthIntent = "login" | "signup";

// Generate login URL at runtime so redirect URI reflects the current origin.
// The intent is stored only in a short-lived, same-site cookie so the callback
// can distinguish a deliberate Google signup from a returning-user login.
export const getLoginUrl = (intent: OAuthIntent = "login") => {
  document.cookie = `valisse_oauth_intent=${intent}; Path=/; Max-Age=600; SameSite=Lax`;
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
