import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// The palette in `globals.css` is the only source of color in the product, and
// PRODUCT.md commits to WCAG 2.2 AA. Five hue families across two themes is far
// more color than anyone can verify by eye, so it is verified here instead: this
// suite fails the build when a token drifts below its required ratio.
//
// DESIGN.md § Colors: adding a color without adding it to this audit is not
// permitted.

const CSS = readFileSync(path.join(__dirname, "globals.css"), "utf8");

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

type Declaration = { selector: string; property: string; value: string };

function parseDeclarations(css: string): Declaration[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const declarations: Declaration[] = [];
  const stack: string[] = [];
  let buffer = "";

  const flush = () => {
    const text = buffer.trim();
    const separator = text.indexOf(":");
    if (separator > 0 && stack.length === 1) {
      declarations.push({
        selector: stack[0],
        property: text.slice(0, separator).trim(),
        value: text.slice(separator + 1).trim(),
      });
    }
    buffer = "";
  };

  for (const character of stripped) {
    if (character === "{") {
      stack.push(buffer.trim().replace(/\s+/g, " "));
      buffer = "";
    } else if (character === "}") {
      flush();
      stack.pop();
    } else if (character === ";") {
      flush();
    } else {
      buffer += character;
    }
  }

  return declarations;
}

function tokensFor(selectors: string[]): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const selector of selectors) {
    for (const declaration of parseDeclarations(CSS)) {
      if (declaration.selector === selector && declaration.property.startsWith("--")) {
        tokens.set(declaration.property, declaration.value);
      }
    }
  }
  return tokens;
}

// Light inherits :root plus the pinned signal block. Dark layers .dark on top,
// which is exactly how the cascade resolves it in the browser.
const LIGHT = tokensFor([":root", ":root, .dark"]);
const DARK = tokensFor([":root", ":root, .dark", ".dark"]);

function parseOklch(value: string): [number, number, number] {
  const match = value.match(
    /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*\)/i,
  );
  if (!match) throw new Error(`Not an oklch() value: ${value}`);
  const lightness = match[1].endsWith("%")
    ? Number.parseFloat(match[1]) / 100
    : Number.parseFloat(match[1]);
  return [lightness, Number.parseFloat(match[2]), Number.parseFloat(match[3])];
}

function oklchToLinearSrgb(
  lightness: number,
  chroma: number,
  hue: number,
): [number, number, number] {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const encode = (channel: number) =>
  channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * channel ** (1 / 2.4) - 0.055;

const decode = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

// Round-trip through the gamma-encoded, clamped values so an out-of-gamut
// colour is measured as the browser would actually paint it, not as its
// unrepresentable linear form.
function relativeLuminance(value: string): number {
  const [red, green, blue] = oklchToLinearSrgb(...parseOklch(value)).map(
    (channel) => decode(clamp(encode(channel))),
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

const FAMILIES = [
  "brand",
  "success",
  "warning",
  "destructive",
  "provisional",
] as const;

const SIGNALS = [
  "success",
  "warning",
  "destructive",
  "provisional",
  "neutral",
] as const;

type Pair = { name: string; foreground: string; background: string; min: number };

function pairsFor(tokens: Map<string, string>): Pair[] {
  const pairs: Pair[] = [
    { name: "foreground on background", foreground: "--foreground", background: "--background", min: AA_TEXT },
    { name: "foreground on card", foreground: "--foreground", background: "--card", min: AA_TEXT },
    { name: "foreground on popover", foreground: "--foreground", background: "--popover", min: AA_TEXT },
    { name: "muted-foreground on background", foreground: "--muted-foreground", background: "--background", min: AA_TEXT },
    { name: "muted-foreground on card", foreground: "--muted-foreground", background: "--card", min: AA_TEXT },
    { name: "muted-foreground on muted", foreground: "--muted-foreground", background: "--muted", min: AA_TEXT },
    { name: "primary-foreground on primary", foreground: "--primary-foreground", background: "--primary", min: AA_TEXT },
    { name: "secondary-foreground on secondary", foreground: "--secondary-foreground", background: "--secondary", min: AA_TEXT },
    { name: "accent-foreground on accent", foreground: "--accent-foreground", background: "--accent", min: AA_TEXT },
    { name: "sidebar-foreground on sidebar", foreground: "--sidebar-foreground", background: "--sidebar", min: AA_TEXT },
    { name: "sidebar-primary-foreground on sidebar-primary", foreground: "--sidebar-primary-foreground", background: "--sidebar-primary", min: AA_TEXT },
    { name: "sidebar-accent-foreground on sidebar-accent", foreground: "--sidebar-accent-foreground", background: "--sidebar-accent", min: AA_TEXT },
    // 1.4.11: the focus indicator is a non-text contrast requirement.
    { name: "ring on background", foreground: "--ring", background: "--background", min: AA_NON_TEXT },
    { name: "ring on card", foreground: "--ring", background: "--card", min: AA_NON_TEXT },
  ];

  for (const family of FAMILIES) {
    pairs.push(
      { name: `${family}-foreground on ${family}`, foreground: `--${family}-foreground`, background: `--${family}`, min: AA_TEXT },
      { name: `${family}-text on background`, foreground: `--${family}-text`, background: "--background", min: AA_TEXT },
      { name: `${family}-text on card`, foreground: `--${family}-text`, background: "--card", min: AA_TEXT },
      { name: `${family}-text on ${family}-subtle`, foreground: `--${family}-text`, background: `--${family}-subtle`, min: AA_TEXT },
      // The subtle surface has to be discernible from the page behind it, or a
      // tinted alert is invisible.
      { name: `${family}-border on ${family}-subtle`, foreground: `--${family}-border`, background: `--${family}-subtle`, min: 1.2 },
    );
  }

  for (const signal of SIGNALS) {
    pairs.push({
      name: `signal-${signal}-text on signal-${signal}`,
      foreground: `--signal-${signal}-text`,
      background: `--signal-${signal}`,
      min: AA_TEXT,
    });
  }

  return pairs.filter(
    (pair) => tokens.has(pair.foreground) && tokens.has(pair.background),
  );
}

describe.each([
  ["light", LIGHT],
  ["dark", DARK],
])("%s theme contrast", (_theme, tokens) => {
  const pairs = pairsFor(tokens);

  it("declares every token the audit expects", () => {
    const expected = new Set(
      pairsFor(LIGHT).flatMap((pair) => [pair.foreground, pair.background]),
    );
    const missing = [...expected].filter((token) => !tokens.has(token));
    expect(missing).toEqual([]);
  });

  it.each(pairs.map((pair) => [pair.name, pair] as const))(
    "%s meets its minimum ratio",
    (_name, pair) => {
      const ratio = contrast(
        tokens.get(pair.foreground)!,
        tokens.get(pair.background)!,
      );
      expect(
        Number(ratio.toFixed(2)),
        `${pair.name} is ${ratio.toFixed(2)}:1, needs ${pair.min}:1`,
      ).toBeGreaterThanOrEqual(pair.min);
    },
  );
});

describe("signal tokens", () => {
  // The scanner outcome must not change with the theme: a rejection rendered as
  // dark red on black is unreadable across a lit gymnasium. DESIGN.md pins
  // these, so drifting one into `.dark` is a regression this catches.
  it.each(SIGNALS)("signal-%s is identical in both themes", (signal) => {
    expect(DARK.get(`--signal-${signal}`)).toBe(LIGHT.get(`--signal-${signal}`));
    expect(DARK.get(`--signal-${signal}-text`)).toBe(
      LIGHT.get(`--signal-${signal}-text`),
    );
  });

  it.each(SIGNALS)("signal-%s stays high-luminance", (signal) => {
    // Bright ambient light washes out dark surfaces. Every signal surface sits
    // near the top of the range so the outcome reads at arm's length.
    expect(relativeLuminance(LIGHT.get(`--signal-${signal}`)!)).toBeGreaterThan(
      0.6,
    );
  });
});

describe("palette hygiene", () => {
  it("carries a tint on every neutral", () => {
    // A chroma of exactly 0 is the absence of a hue decision, which is what the
    // stock preset shipped. DESIGN.md § Neutrals requires the ramp be tinted.
    const neutrals = [
      "--background",
      "--foreground",
      "--muted",
      "--muted-foreground",
      "--border",
      "--primary",
    ];
    for (const [theme, tokens] of [
      ["light", LIGHT],
      ["dark", DARK],
    ] as const) {
      for (const token of neutrals) {
        const [, chroma] = parseOklch(tokens.get(token)!);
        expect(chroma, `${theme} ${token} has no tint`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the outcome hues far enough apart to be told apart", () => {
    const hues = FAMILIES.map(
      (family) => parseOklch(LIGHT.get(`--${family}`)!)[2],
    );
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const delta = Math.abs(hues[i] - hues[j]);
        const separation = Math.min(delta, 360 - delta);
        expect(
          separation,
          `${FAMILIES[i]} and ${FAMILIES[j]} are only ${separation}° apart`,
        ).toBeGreaterThanOrEqual(35);
      }
    }
  });

  it("has no violet left over from the stock preset", () => {
    // The preset shipped --sidebar-primary at oklch(0.488 0.243 264) in dark
    // mode: a saturated violet, the one anti-reference PRODUCT.md names, sitting
    // unused in a palette nobody had authored.
    for (const [theme, tokens] of [
      ["light", LIGHT],
      ["dark", DARK],
    ] as const) {
      for (const [token, value] of tokens) {
        if (!value.startsWith("oklch")) continue;
        const [, chroma, hue] = parseOklch(value);
        const isViolet = hue > 270 && hue < 330 && chroma > 0.1;
        expect(isViolet, `${theme} ${token} is ${value}`).toBe(false);
      }
    }
  });
});
