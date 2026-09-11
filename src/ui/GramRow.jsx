import React from "react";
import { fmt, fmtW } from "../core/money.js";

function GramRow({ label, grams, amount, currency, accent, strong, indent }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)", paddingRight: indent ? 12 : 0 }}>
      <span style={{ color: strong ? "var(--text)" : "var(--text2)" }} className={strong ? "text-xs font-bold" : "text-xs"}>
        {label}
      </span>
      <div className="text-left">
        <span style={{ color: accent || (grams >= 0 ? "var(--goodSolid)" : "var(--bad)") }} className="text-xs font-bold">
          {grams < 0 ? "−" : ""}
          {fmtW(Math.abs(grams))} جم
        </span>
        <span style={{ color: "var(--text3)" }} className="text-[10px] block">
          {currency}
          {fmt(Math.abs(amount), 0)}
        </span>
      </div>
    </div>
  );
}

export { GramRow };
