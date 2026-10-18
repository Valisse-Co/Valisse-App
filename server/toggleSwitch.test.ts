import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ToggleSwitch } from "../client/src/components/ui/toggle-switch";

describe("shared toggle geometry", () => {
  it("starts every size with the thumb on the left in the off state", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      const html = renderToStaticMarkup(React.createElement(ToggleSwitch, { checked: false, onCheckedChange: () => undefined, size, "aria-label": `${size} toggle` }));
      expect(html).toContain('role="switch"');
      expect(html).toContain('aria-checked="false"');
      expect(html).toContain("translate-x-0");
    }
  });

  it("moves each thumb only to its matching in-track enabled position", () => {
    const expectedTransforms = { sm: "translate-x-4", md: "translate-x-5", lg: "translate-x-5" } as const;
    for (const [size, transform] of Object.entries(expectedTransforms) as Array<[keyof typeof expectedTransforms, string]>) {
      const html = renderToStaticMarkup(React.createElement(ToggleSwitch, { checked: true, onCheckedChange: () => undefined, size, "aria-label": `${size} toggle` }));
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain(transform);
      expect(html).not.toContain("translate-x-6");
    }
  });
});
