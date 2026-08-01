import { ImageResponse } from "next/og";

export const alt =
  "EventPass — event check-in that keeps working when the venue network does not";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

// Satori resolves neither CSS custom properties nor the app's font variables, so
// this surface has to restate both. Every value below is the sRGB conversion of
// a light-mode token in globals.css — nothing here is a new colour, and if a
// token moves these have to be re-derived.
const INK = "#22222b"; // --foreground
const PAPER = "#fcfdfe"; // --background
const MUTED = "#6f6f7d"; // --muted-foreground
const HAIRLINE = "#e6e6ea"; // --border

async function interSubset(text: string, weight: 400 | 500 | 600) {
  // The product speaks in one typeface. A card that falls back to Satori's
  // default sans is the one place EventPass appeared in a face it does not own,
  // and it is the first thing anyone sees of the product.
  const url = `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await fetch(url, {
    headers: {
      // Without a browser UA, Google serves woff2, which Satori cannot read.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36",
    },
  }).then((response) => response.text());
  const source = /src: url\((https:[^)]+)\) format\('(opentype|truetype)'\)/.exec(css);
  if (!source) return null;
  return fetch(source[1]!).then((response) => response.arrayBuffer());
}

const HEADLINE = "Keep the line moving when the Wi-Fi doesn’t.";
const SUBHEAD = "Registration, tickets, and door check-in for in-person events.";
const FOOTER = "Registration · Tickets · Door check-in · Works offline";
const WORDMARK = "EventPass";

export default async function OpenGraphImage() {
  const [regular, medium] = await Promise.all([
    interSubset(`${SUBHEAD}${FOOTER}`, 400),
    interSubset(`${HEADLINE}${WORDMARK}`, 500),
  ]);

  const fonts = [
    regular && { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
    medium && { name: "Inter", data: medium, weight: 500 as const, style: "normal" as const },
  ].filter((font) => font !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          color: INK,
          padding: "72px",
          fontFamily: "Inter",
          // A hairline, like every other region boundary in the product. The
          // 16px ink bar that used to sit here was the only heavy rule anywhere.
          borderTop: `2px solid ${INK}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* The same mark the product uses: an ink tile at the control radius
              carrying a ticket, not a teal square with initials in it. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "52px",
              height: "52px",
              borderRadius: "6px",
              background: INK,
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={PAPER} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5v2" />
              <path d="M15 11v2" />
              <path d="M15 17v2" />
              <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4v-3a2 2 0 0 1 2 -2" />
            </svg>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 500, letterSpacing: "-0.021em" }}>
            {WORDMARK}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div
            style={{
              fontSize: "60px",
              // The headline weight is 560; Satori takes a real file, and 500 is
              // the nearest one loaded. 600 is the scanner's weight, not this.
              fontWeight: 500,
              letterSpacing: "-0.027em",
              lineHeight: 1.0333,
              // The full content width. At 960 the line broke inside "Wi-Fi",
              // leaving "Wi-" hanging — the same break the landing page pins
              // shut with `whitespace-nowrap`, which Satori does not support.
              maxWidth: "1056px",
            }}
          >
            {HEADLINE}
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 400,
              letterSpacing: "-0.019em",
              lineHeight: 1.3333,
              color: MUTED,
              maxWidth: "900px",
            }}
          >
            {SUBHEAD}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: "20px",
            fontWeight: 400,
            letterSpacing: "-0.017em",
            color: MUTED,
            borderTop: `1px solid ${HAIRLINE}`,
            paddingTop: "28px",
          }}
        >
          {FOOTER}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
