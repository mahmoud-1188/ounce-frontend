import React from "react";
import { Card } from "./Card.jsx";

function Stat({ label, value, sub, accent }) {
  return (
    <Card style={{ padding: 12 }}>
      <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
        {label}
      </p>
      <p style={{ fontFamily: "'Cairo', sans-serif", color: accent || "var(--text)" }} className="text-lg font-extrabold">
        {value}
      </p>
      {sub && (
        <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
          {sub}
        </p>
      )}
    </Card>
  );
}

// ============================================================
// App
// ============================================================

export { Stat };
