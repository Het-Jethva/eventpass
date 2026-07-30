import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// DESIGN.md states several rules that are easy to state and easy to violate
// six months later, so they are checked rather than trusted. The palette had
// already drifted this way once: the doc said component colours must come from
// semantic tokens, but the token set was too small to obey, and components
// quietly reached for text-emerald-600 and bg-amber-500/5 in the highest-stakes
// screens in the product.

const ROOT = path.join(__dirname, "..");
const SOURCE_DIRECTORIES = ["app", "components", "features"];

function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const full = path.join(directory, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (full.endsWith(".tsx")) files.push(full);
    }
  };
  for (const directory of SOURCE_DIRECTORIES) walk(path.join(ROOT, directory));
  return files;
}

const FILES = sourceFiles().map((file) => ({
  path: path.relative(ROOT, file).replace(/\\/g, "/"),
  source: readFileSync(file, "utf8"),
}));

// Elevation is permitted only where something genuinely passes over content.
const OVERLAY_FILES = new Set([
  "components/ui/alert-dialog.tsx",
  "components/ui/select.tsx",
  "features/admin/admin-action-dialog.tsx",
  "app/(workspace)/events/[eventId]/(sections)/event-sidebar.tsx",
]);

describe("design rules", () => {
  it("finds source files to check", () => {
    expect(FILES.length).toBeGreaterThan(30);
  });

  it("takes every colour from semantic tokens", () => {
    // Tailwind's own palette scales are the failure mode: they bypass the token
    // layer entirely and cannot respond to theme or be audited for contrast.
    const palette =
      /\b(?:bg|text|border|ring|fill|stroke|from|to|via|decoration|outline|shadow|accent|caret|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
    const offenders = FILES.flatMap(({ path: file, source }) =>
      (source.match(palette) ?? []).map((match) => `${file}: ${match}`),
    );
    expect(offenders).toEqual([]);
  });

  it("uses the type scale rather than arbitrary sizes", () => {
    const arbitrary = /\btext-\[\d+(?:\.\d+)?(?:px|rem)\]/g;
    const offenders = FILES.flatMap(({ path: file, source }) =>
      (source.match(arbitrary) ?? []).map((match) => `${file}: ${match}`),
    );
    expect(offenders).toEqual([]);
  });

  it("reserves elevation for genuine overlays", () => {
    const shadow = /\bshadow-(?:xs|sm|md|lg|xl|2xl)\b/g;
    const offenders = FILES.filter(({ path: file }) => !OVERLAY_FILES.has(file))
      .flatMap(({ path: file, source }) =>
        (source.match(shadow) ?? []).map((match) => `${file}: ${match}`),
      );
    expect(offenders).toEqual([]);
  });

  it("keeps buttons off the pill radius", () => {
    const button = FILES.find(
      ({ path: file }) => file === "components/ui/button.tsx",
    );
    expect(button).toBeDefined();
    expect(button!.source).toContain("rounded-md");
    expect(button!.source).not.toContain("rounded-4xl");
  });

  it("keeps the display serif off operational text", () => {
    // The serif is permitted on organizer page titles, public pages, landing
    // headlines, and the Event name on a Ticket. It is not permitted on
    // scanner outcomes, status labels, or anything a volunteer reads under
    // pressure — arm's-length legibility is a safety property.
    const operational = [
      "features/admission/scan-outcome.tsx",
      "features/admission/scanner-workspace.tsx",
      "components/ui/badge.tsx",
      "components/ui/alert.tsx",
    ];
    for (const file of operational) {
      const entry = FILES.find((candidate) => candidate.path === file);
      expect(entry, `${file} is missing`).toBeDefined();
      expect(entry!.source, `${file} uses the display serif`).not.toContain(
        "font-heading",
      );
    }
  });
});
