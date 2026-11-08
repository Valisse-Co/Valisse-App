import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { isResendConfigured, sendSecurityEmail } from "./resend";

const original = {
  key: ENV.resendApiKey,
  from: ENV.resendFromEmail,
  url: ENV.publicAppUrl,
};
const token = "a".repeat(43);
const tokenHash = "b".repeat(64);
const expiresAt = new Date("2026-11-08T00:30:00.000Z");

beforeEach(() => {
  ENV.resendApiKey = "test-only-not-a-real-key";
  ENV.resendFromEmail = "Valisse <security@example.com>";
  ENV.publicAppUrl = "https://www.example.com";
});
afterEach(() => {
  ENV.resendApiKey = original.key;
  ENV.resendFromEmail = original.from;
  ENV.publicAppUrl = original.url;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Resend security email transport (mocked fetch only)", () => {
  it("uses backend Resend JSON, canonical HTTPS fragment links, and hash-only idempotency", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendSecurityEmail({
      purpose: "verify_email",
      to: "user@example.com",
      token,
      tokenHash,
      expiresAt,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, options] = fetchMock.mock.calls[0]!;
    expect(endpoint).toBe("https://api.resend.com/emails");
    expect(options).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: "Bearer test-only-not-a-real-key",
        "Content-Type": "application/json",
        "Idempotency-Key": `valisse/verify_email/${tokenHash}`,
      },
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      from: "Valisse <security@example.com>",
      to: ["user@example.com"],
      subject: "Verify your Valisse email",
    });
    expect(body.text).toContain(
      `https://www.example.com/verify-email#token=${token}`
    );
    expect(body.text).not.toContain("?token=");
    expect(body.html).toContain(
      `href="https://www.example.com/verify-email#token=${token}"`
    );
    expect(body.html).toContain("24 hours");
    expect(body.text).toContain("safely ignore");
    expect(options.headers["Idempotency-Key"]).not.toContain(token);
    expect(body).not.toHaveProperty("tokenHash");
  });

  it("includes reset expiry and a separate password-changed notice without a token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendSecurityEmail({
      purpose: "reset_password",
      to: "user@example.com",
      token,
      tokenHash,
      expiresAt,
    });
    const reset = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(reset.text).toContain(`/reset-password#token=${token}`);
    expect(reset.html).toContain("30 minutes");
    expect(reset.text).toContain(expiresAt.toISOString());
    await sendSecurityEmail({
      purpose: "password_changed",
      to: "user@example.com",
      tokenHash,
    });
    const changed = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(changed.subject).toBe("Your Valisse password was changed");
    expect(changed.text).toContain("Existing sessions have been revoked");
    expect(changed.text).toContain("If you did not make this change");
    expect(changed.text).not.toContain("#token");
    expect(changed.html).not.toContain(token);
    expect(fetchMock.mock.calls[1]![1].headers["Idempotency-Key"]).toBe(
      `valisse/password_changed/${tokenHash}`
    );
  });

  it.each([
    "http://example.com",
    "https://user:password@example.com",
    "https://example.com/?origin=evil",
    "https://example.com/#evil",
    "https://example.com/path",
    "not-a-url",
  ])("fails closed for noncanonical configured app URL %s", async url => {
    ENV.publicAppUrl = url;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(isResendConfigured()).toBe(false);
    await expect(
      sendSecurityEmail({
        purpose: "verify_email",
        to: "user@example.com",
        token,
        tokenHash,
        expiresAt,
      })
    ).rejects.toThrow("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses missing configuration, header injection, and HTML/token injection", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    ENV.resendApiKey = "";
    expect(isResendConfigured()).toBe(false);
    ENV.resendApiKey = "test-key";
    ENV.resendFromEmail = "security@example.com\r\nBcc: evil@example.com";
    expect(isResendConfigured()).toBe(false);
    ENV.resendFromEmail = "security@example.com";
    await expect(
      sendSecurityEmail({
        purpose: "verify_email",
        to: "user@example.com",
        token: `<script>${token}`,
        tokenHash,
        expiresAt,
      })
    ).rejects.toThrow("Invalid security email");
    await expect(
      sendSecurityEmail({
        purpose: "verify_email",
        to: "<script>@example.com",
        token,
        tokenHash,
        expiresAt,
      })
    ).rejects.toThrow("Invalid security email");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never parses or surfaces the provider body or network error", async () => {
    const json = vi
      .fn()
      .mockResolvedValue({ error: `sensitive user@example.com ${token}` });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, json, text: json, body: null });
    vi.stubGlobal("fetch", fetchMock);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      sendSecurityEmail({
        purpose: "reset_password",
        to: "user@example.com",
        token,
        tokenHash,
        expiresAt,
      })
    ).rejects.toThrow("Security email delivery failed. Please try again.");
    expect(json).not.toHaveBeenCalled();
    fetchMock.mockRejectedValue(
      new Error(`secret provider token=${token} user@example.com`)
    );
    await expect(
      sendSecurityEmail({
        purpose: "reset_password",
        to: "user@example.com",
        token,
        tokenHash,
        expiresAt,
      })
    ).rejects.toThrow(/^Security email delivery failed\. Please try again\.$/);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("aborts provider requests at ten seconds and cancels the timer", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(new Error("aborted"))
          );
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const promise = sendSecurityEmail({
      purpose: "verify_email",
      to: "user@example.com",
      token,
      tokenHash,
      expiresAt,
    });
    const rejection = expect(promise).rejects.toThrow(
      "Security email delivery failed"
    );
    await vi.advanceTimersByTimeAsync(9999);
    expect(fetchMock.mock.calls[0]![1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(fetchMock.mock.calls[0]![1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
