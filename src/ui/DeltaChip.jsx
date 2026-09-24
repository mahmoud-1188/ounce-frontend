import React from "react";

function DeltaChip({ pct, up = "good" }) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  const rising = pct > 0;
  const good = up === "good" ? rising : up === "bad" ? !rising : null;
  const color = pct === 0 ? "var(--text3)" : good === null ? "var(--text2)" : good ? "var(--good)" : "var(--bad)";
  const bg = pct === 0 ? "var(--field)" : good === null ? "var(--field)" : good ? "var(--goodBg)" : "var(--badBg)";
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ color, background: bg, whiteSpace: "nowrap" }}
      title="مقارنةً بالفترة السابقة بالطول نفسه">
      {pct === 0 ? "—" : `${rising ? "▲" : "▼"} ${Math.abs(pct)}٪`}
    </span>
  );
}

/// طيٌّ وفتحٌ بحركة — بلا قياس ارتفاع: `grid-template-rows: 0fr → 1fr`.

export { DeltaChip };
