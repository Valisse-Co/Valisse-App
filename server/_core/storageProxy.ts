import type { Express } from "express";
import { Readable } from "node:stream";
import { inferStorageContentType } from "../../shared/storageMedia";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key || key.includes("..")) {
      res.status(400).send("Invalid storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });
      if (!forgeResp.ok) {
        console.error(`[StorageProxy] forge error: ${forgeResp.status}`);
        res.status(forgeResp.status === 404 ? 404 : 502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      const range = typeof req.headers.range === "string" ? req.headers.range : undefined;
      const upstream = await fetch(url, { headers: range ? { Range: range } : undefined });
      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).send("Stored media unavailable");
        return;
      }

      res.status(upstream.status);
      res.set("Content-Type", inferStorageContentType(key, upstream.headers.get("content-type")));
      res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.set("X-Content-Type-Options", "nosniff");
      for (const header of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"] as const) {
        const value = upstream.headers.get(header);
        if (value) res.set(header, value);
      }

      if (!upstream.body) {
        res.end();
        return;
      }
      Readable.fromWeb(upstream.body as any).on("error", (error) => {
        console.error("[StorageProxy] stream failed:", error);
        if (!res.headersSent) res.status(502);
        res.end();
      }).pipe(res);
    } catch (error) {
      console.error("[StorageProxy] failed:", error);
      if (!res.headersSent) res.status(502).send("Storage proxy error");
      else res.end();
    }
  });
}
