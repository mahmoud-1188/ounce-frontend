import React from "react";
import { fmt, fmtW } from "../core/money.js";

function GramValue({ grams, amount, currency, size = "lg", accent }) {
  const color = accent || (grams >= 0 ? "var(--goodSolid)" : "var(--bad)");
  const big = size === "lg";
  return (
    <div className="text-left" style={{ direction: "rtl" }}>
      <p
        style={{ color, fontFamily: "'Cairo', sans-serif" }}
        className={big ? "text-xl font-extrabold leading-tight" : "text-sm font-bold leading-tight"}
      >
        {grams < 0 ? "−" : ""}
        {fmtW(Math.abs(grams))} جم
      </p>
      <p style={{ color: "var(--text3)" }} className={big ? "text-[11px]" : "text-[10px]"}>
        {currency}
        {fmt(Math.abs(amount), 0)}
        {grams < 0 ? " (سالب)" : ""}
      </p>
    </div>
  );
}

/// صف يعرض الوزن والمبلغ معًا داخل جدول التقرير.

export { GramValue };
