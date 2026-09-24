import { describe, expect, it } from "vitest";
import { getPreviewHmrClientOptions, PREVIEW_HMR_CLIENT_PORT } from "./_core/viteHmr";

describe("preview HMR configuration", () => {
  it("routes the browser HMR client through the public HTTPS gateway", () => {
    expect(PREVIEW_HMR_CLIENT_PORT).toBe(443);
    expect(getPreviewHmrClientOptions()).toEqual({
      protocol: "wss",
      clientPort: 443,
    });
  });
});
