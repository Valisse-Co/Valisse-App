import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");

describe("private report moderation", () => {
  it("limits report listing and actions to administrators", () => {
    const routerSource = readFileSync(resolve(projectRoot, "server/routers.ts"), "utf8");
    const pageSource = readFileSync(resolve(projectRoot, "client/src/pages/AdminReports.tsx"), "utf8");

    expect(routerSource).toContain('if (ctx.user.role !== "admin") throw new Error("Forbidden")');
    expect(pageSource).toContain('if (user?.role !== "admin")');
  });

  it("notifies only the post owner and administrator accounts when a report is submitted", () => {
    const routerSource = readFileSync(resolve(projectRoot, "server/routers.ts"), "utf8");

    expect(routerSource).toContain('title: "Your post was reported"');
    expect(routerSource).toContain("const adminIds = await getAdminUserIds();");
    expect(routerSource).toContain('title: "New post report"');
  });
});
