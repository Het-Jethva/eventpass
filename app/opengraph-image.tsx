import { ImageResponse } from "next/og";

export const alt =
  "EventPass — event check-in that stays trustworthy when the internet does not";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          color: "#0a0a0a",
          padding: "72px",
          borderTop: "16px solid #0a0a0a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "#0a0a0a",
              color: "#ffffff",
              fontSize: "30px",
              fontWeight: 600,
            }}
          >
            EP
          </div>
          <div style={{ fontSize: "30px", fontWeight: 600 }}>EventPass</div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <div
            style={{
              fontSize: "62px",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.12,
              maxWidth: "960px",
            }}
          >
            Event check-in that stays trustworthy when the internet does not.
          </div>
          <div
            style={{
              fontSize: "28px",
              lineHeight: 1.45,
              color: "#525252",
              maxWidth: "900px",
            }}
          >
            Signed single-entry tickets, a bounded offline scanner, and
            conflict resolution you can audit.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            fontSize: "22px",
            color: "#525252",
            borderTop: "2px solid #e5e5e5",
            paddingTop: "28px",
          }}
        >
          <span>Next.js</span>
          <span>·</span>
          <span>PostgreSQL</span>
          <span>·</span>
          <span>ECDSA P-256 tickets</span>
          <span>·</span>
          <span>Offline-capable PWA</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
