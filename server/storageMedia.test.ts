import { describe, expect, it } from "vitest";
import { inferStorageContentType } from "../shared/storageMedia";

describe("storage media content types", () => {
  it("repairs generic octet-stream image responses from file extensions", () => {
    expect(inferStorageContentType("posts/1/look.png", "application/octet-stream")).toBe("image/png");
    expect(inferStorageContentType("posts/1/look.webp", "application/octet-stream")).toBe("image/webp");
    expect(inferStorageContentType("posts/1/look.jpg", "application/octet-stream")).toBe("image/jpeg");
  });

  it("preserves a meaningful upstream type for unknown extensions", () => {
    expect(inferStorageContentType("files/asset.bin", "application/pdf")).toBe("application/pdf");
    expect(inferStorageContentType("files/asset.bin", "application/octet-stream")).toBe("application/octet-stream");
  });
});
