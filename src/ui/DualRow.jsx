import React from "react";
import { fmtMoney, fmtW } from "../core/money.js";

function DualRow({ label, weight_24k, cash_amount, currency, tone, sub }) {
  const wt = Math.abs(Number(weight_24k) || 0) < 0.0005 ? "text3"
    : (tone || ((weight_24k || 0) >= 0 ? "text" : "bad"));
  const ct = Math.abs(Number(cash_amount) || 0) < 0.005 ? "text3"
    : (tone || ((cash_amount || 0) >= 0 ? "text" : "bad"));
  return (
    <div className="grid items-baseline py-1.5"
      style={{ gridTemplateColumns: "1.3fr 1fr 1fr", gap: 8,
               borderBottom: "1px solid var(--line)" }}>
      <span className="min-w-0">
        <span style={{ color: "var(--text2)" }} className="text-[11px] block truncate">{label}</span>
        {sub && <span style={{ color: "var(--text3)" }} className="text-[9px]">{sub}</span>}
      </span>
      <span style={{ color: `var(--${wt})` }} className="text-[11px] font-bold text-left"
        dir="ltr">
        {Math.abs(Number(weight_24k) || 0) < 0.0005 ? "—"
          : `${(weight_24k || 0) < 0 ? "−" : ""}${fmtW(Math.abs(weight_24k || 0))}`}
      </span>
      <span style={{ color: `var(--${ct})` }} className="text-[11px] font-bold text-left"
        dir="ltr">
        {Math.abs(Number(cash_amount) || 0) < 0.005 ? "—"
          : `${(cash_amount || 0) < 0 ? "−" : ""}${currency}${fmtMoney(Math.abs(cash_amount || 0))}`}
      </span>
    </div>
  );
}

export { DualRow };
