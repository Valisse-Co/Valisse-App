export type OAuthProvider = "manus" | "google" | "apple";
export const OAUTH_STATE_TTL_SECONDS = 600;
export const OAUTH_STATE_COOKIES: Record<OAuthProvider, string> = {
  manus: "__Host-valisse_oauth_manus",
  google: "__Host-valisse_oauth_google",
  apple: "__Host-valisse_oauth_apple",
};
const CALLBACK_PATHS: Record<OAuthProvider, string> = {
  manus: "/api/oauth/callback",
  google: "/api/oauth/google/callback",
  apple: "/api/oauth/apple/callback",
};
export type BrowserOAuthState = { version: 1; provider: OAuthProvider; nonce: string; redirectUri: string };

export function validOAuthRedirectUri(input: string, provider: OAuthProvider): boolean {
  try {
    const url = new URL(input);
    return (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) &&
      !url.username && !url.password && !url.search && !url.hash && url.pathname === CALLBACK_PATHS[provider];
  } catch { return false; }
}
export function encodeOAuthState(input: Omit<BrowserOAuthState, "version">): string {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(input.nonce) || !validOAuthRedirectUri(input.redirectUri, input.provider)) throw new Error("Invalid OAuth state");
  // URI must be ASCII after URL normalization, so this is portable in Node/browser.
  return btoa(JSON.stringify({ version: 1, ...input, redirectUri: new URL(input.redirectUri).toString() }));
}
export function decodeOAuthState(raw: unknown, provider: OAuthProvider): BrowserOAuthState | null {
  try {
    if (typeof raw !== "string" || raw.length > 4096) return null;
    const parsed = JSON.parse(atob(raw));
    if (!parsed || parsed.version !== 1 || parsed.provider !== provider || typeof parsed.nonce !== "string" || !/^[A-Za-z0-9_-]{32,64}$/.test(parsed.nonce) || typeof parsed.redirectUri !== "string" || !validOAuthRedirectUri(parsed.redirectUri, provider)) return null;
    return { version: 1, provider, nonce: parsed.nonce, redirectUri: parsed.redirectUri };
  } catch { return null; }
}
