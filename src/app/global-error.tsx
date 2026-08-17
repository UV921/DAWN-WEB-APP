"use client";

export default function GlobalError({
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
          background: "#071018",
          color: "#d6e2ec",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            background: "#0d1b2a",
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 28, color: "#fff" }}>
            Dawn hit a snag
          </h1>
          <p style={{ margin: "12px 0 0", lineHeight: 1.5, color: "#8ba3b8" }}>
            Reload once to pick up the latest version.
          </p>
          <button
            type="button"
            onClick={() => {
              reset();
              window.location.reload();
            }}
            style={{
              marginTop: 24,
              border: 0,
              borderRadius: 999,
              background: "#f0b45a",
              color: "#071018",
              fontWeight: 600,
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Reload Dawn
          </button>
        </div>
      </body>
    </html>
  );
}
