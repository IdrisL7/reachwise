import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GetSignalHooks — Evidence-first hooks from any company URL";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #080808 0%, #0a1a0f 50%, #080808 100%)",
          fontFamily: "system-ui, sans-serif",
          padding: "60px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: 800,
              color: "white",
            }}
          >
            G
          </div>
          <span
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "#34d399",
            }}
          >
            GetSignalHooks
          </span>
        </div>
        <h1
          style={{
            fontSize: "56px",
            fontWeight: 800,
            color: "#fafafa",
            textAlign: "center",
            lineHeight: 1.15,
            margin: "0 0 24px 0",
            maxWidth: "900px",
          }}
        >
          Evidence-first hooks from any company URL
        </h1>
        <p
          style={{
            fontSize: "24px",
            color: "#a1a1aa",
            textAlign: "center",
            margin: 0,
            maxWidth: "700px",
            lineHeight: 1.5,
          }}
        >
          AI-powered research turns public signals into cold email hooks with real quotes, sources, and dates.
        </p>
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "40px",
          }}
        >
          {["Tier A Evidence", "Role-Targeted", "7-Day Free Trial"].map(
            (tag) => (
              <div
                key={tag}
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#34d399",
                  background: "rgba(5, 150, 105, 0.15)",
                  border: "1px solid rgba(5, 150, 105, 0.3)",
                  borderRadius: "8px",
                  padding: "8px 20px",
                }}
              >
                {tag}
              </div>
            ),
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
