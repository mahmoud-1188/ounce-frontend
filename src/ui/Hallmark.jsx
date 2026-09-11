import React from "react";

function Hallmark({ karat, size = 44 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "radial-gradient(circle at 32% 28%, var(--gradFrom) 0%, var(--accentSoft) 45%, #7A5A2E 100%)",
        boxShadow:
          "inset 0 1px 2px rgba(255,255,255,0.35), inset 0 -3px 5px var(--veil), 0 1px 3px var(--veil)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        border: "1px solid var(--accentLine)",
      }}
    >
      <div
        style={{
          width: size - 8,
          height: size - 8,
          borderRadius: "50%",
          border: "1px dotted rgba(28,20,10,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: size * 0.34, color: "var(--panel)", lineHeight: 1 }}>
          {karat}
        </span>
      </div>
    </div>
  );
}

export { Hallmark };
