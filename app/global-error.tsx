"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#fafafa",
          color: "#111",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "480px", textAlign: "center" }}>
          <h1 style={{ fontSize: "20px", margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "14px", margin: "0 0 16px", opacity: 0.75 }}>
            Nothing was changed. Retrying usually resolves it.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 18px",
              fontSize: "14px",
              borderRadius: "10px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: "12px",
                fontFamily: "monospace",
                fontSize: "12px",
                opacity: 0.6,
              }}
            >
              Reference {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
