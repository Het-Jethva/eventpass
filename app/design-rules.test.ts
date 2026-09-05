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

  it("speaks in one voice", () => {
    // This test used to permit a display serif on titles and ban it on
    // operational text. There is no second face any more: DESIGN.md § Typography
    // says hierarchy is size, weight and spacing, and `--font-heading` does not
    // exist. So the rule is now the stronger one — the token appears nowhere.
    const offenders = FILES.filter(({ source }) =>
      source.includes("font-heading"),
    ).map(({ path: file }) => file);
    expect(offenders).toEqual([]);
  });

  it("reserves semibold for the scanner outcome", () => {
    // Weight 600 exists in this product for one reason: to punch across a lit
    // gymnasium. Everywhere else it is the wrong answer to "make this a
    // heading", and it had spread to ten dialog and section titles.
    const permitted = new Set([
      "features/admission/scan-outcome.tsx",
      "features/landing/operations-preview.tsx",
    ]);
    const offenders = FILES.filter(
      ({ path: file, source }) =>
        !permitted.has(file) && source.includes("font-semibold"),
    ).map(({ path: file }) => file);
    expect(offenders).toEqual([]);
  });

  it("leaves optics to the type scale", () => {
    // Leading and letter-spacing are properties of a size, declared once on
    // every `--text-*` step. A product component that sets them is overriding a
    // decision that was already made correctly — and thirty of them doing it
    // identically meant the scale was missing a step, not that thirty
    // components were wrong. It now carries `text-support` and `text-reading`.
    //
    // `components/ui` is out of scope on purpose: those are unmodified shadcn
    // primitives, and the system's rule is to leave them that way.
    // `tracking-code` is a token, not a re-guessed number.
    const optical = /\b(?:tracking|leading)-(?!code\b)[a-z0-9.[\]-]+/g;
    const offenders = FILES.filter(
      ({ path: file }) => !file.startsWith("components/ui/"),
    ).flatMap(({ path: file, source }) =>
      (source.match(optical) ?? []).map((match) => `${file}: ${match}`),
    );
    expect(offenders).toEqual([]);
  });

  it("takes the scrim from a token", () => {
    // `black` and `white` bypass the token layer exactly like a palette scale
    // does, and two dialogs had each picked their own opacity of it. The QR
    // chamber is the one real exception: a theme-inverted QR does not scan.
    const raw = /\b(?:bg|text|border|ring|from|to|via)-(?:black|white)\b/g;
    const permitted = new Set(["features/tickets/ticket-stub.tsx"]);
    const offenders = FILES.filter(({ path: file }) => !permitted.has(file))
      .flatMap(({ path: file, source }) =>
        (source.match(raw) ?? []).map((match) => `${file}: ${match}`),
      );
    expect(offenders).toEqual([]);
  });

  it("keeps a `use server` module to async exports", () => {
    // Next replaces every non-function export of a `"use server"` module with a
    // server reference, so a plain object imported from one arrives on the
    // client with none of its properties. It type-checks, and it silently put
    // every form in the product into a non-idle state on first render: an
    // attendee opening their ticket met three "Action not completed" alerts
    // before touching anything.
    const actionFiles: { path: string; source: string }[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const full = path.join(directory, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!full.endsWith(".ts")) continue;
        const source = readFileSync(full, "utf8");
        if (!/^["']use server["'];/m.test(source)) continue;
        actionFiles.push({
          path: path.relative(ROOT, full).replace(/\\/g, "/"),
          source,
        });
      }
    };
    for (const directory of SOURCE_DIRECTORIES) walk(path.join(ROOT, directory));

    expect(actionFiles.length).toBeGreaterThan(5);
    const offenders = actionFiles.flatMap(({ path: file, source }) =>
      (source.match(/^export const \w+/gm) ?? []).map(
        (match) => `${file}: ${match}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
