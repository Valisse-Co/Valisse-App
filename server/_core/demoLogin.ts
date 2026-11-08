import type { Express } from "express";

/** Permanently retired. Old bookmarks must fail closed in every environment.
 * QA account switching uses the separately administrator-authorized QA lab. */
export function registerDemoLoginRoutes(app: Express) {
  app.all("/api/demo-login/*", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
}
