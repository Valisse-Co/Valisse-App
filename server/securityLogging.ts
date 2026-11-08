const SAFE_ERROR_NAMES = new Set([
  "Error", "TypeError", "RangeError", "SyntaxError", "AbortError", "AxiosError",
  "TRPCError", "StripeError", "StripeAPIError", "StripeInvalidRequestError",
  "StripeAuthenticationError", "StripeConnectionError", "StripeRateLimitError",
]);

/** Never return an error message, stack, request config, URL, headers or payload.
 * OAuth/HTTP errors often embed credentials and identity data in those fields. */
export function safeErrorDetails(error: unknown): { name: string; status?: number } {
  try {
    if (typeof error !== "object" || error === null) return { name: "Error" };
    const value = error as { name?: unknown; status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
    const name = typeof value.name === "string" && SAFE_ERROR_NAMES.has(value.name) ? value.name : "Error";
    const candidate = value.statusCode ?? value.status ?? value.response?.status;
    const status = typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 100 && candidate <= 599 ? candidate : undefined;
    return status === undefined ? { name } : { name, status };
  } catch {
    return { name: "Error" };
  }
}
