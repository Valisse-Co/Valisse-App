/**
 * The Manus preview gateway terminates HTTPS/WSS on port 443 and forwards it to
 * the application's internal HTTP server. Supplying these client-side HMR
 * values makes Vite reconnect through the same public origin instead of its
 * unreachable default direct fallback (localhost:5173).
 */
export const PREVIEW_HMR_CLIENT_PORT = 443;

export function getPreviewHmrClientOptions() {
  return {
    protocol: "wss" as const,
    clientPort: PREVIEW_HMR_CLIENT_PORT,
  };
}
