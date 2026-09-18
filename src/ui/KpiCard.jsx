import React from "react";
import { fmtMoney, fmtW } from "../core/money.js";
import { Card } from "./Card.jsx";

function KpiCard({ def, value, cmp, currency }) {
  const fmtV = (v) =>
    def.unit === "money" ? `${currency}${fmtMoney(v)}`
      : def.unit === "weight" ? `${fmtW(v)} جم`
      : String(v);

  // ⚠ اللون يتبع «هل هذا خير» لا «هل ارتفع».
  //
  // المصروفات ترتفع فتُلوَّن حمراء. وتلوينها خضراء لأنها زادت يُطمئن
  // على ما يجب أن يُقلق.
  const good = cmp && cmp.dir !== "flat"
    ? (cmp.dir === "up") === !!def.goodUp
    : null;
  const tone = good === null ? "text2" : good ? "good" : "bad";

  return (
    <Card style={{ padding: 11 }}>
      <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">
        {def.label}
      </p>
      <p style={{ color: "var(--text)", margin: "2px 0 0" }} className="text-[15px] font-bold">
        {fmtV(value)}
      </p>
      {cmp && (
        <p style={{ color: `var(--${tone})`, margin: 0 }} className="text-[10px]">
          {cmp.dir === "flat" ? "بلا تغيّر" : (
            <>
              {cmp.dir === "up" ? "▲" : "▼"} {fmtV(Math.abs(cmp.diff))}
              {cmp.pct !== null && ` · ${cmp.pct > 0 ? "+" : ""}${cmp.pct}٪`}
            </>
          )}
        </p>
      )}
      {cmp && cmp.pct === null && cmp.before === 0 && cmp.now > 0 && (
        <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px]">
          ⚖ من لا شيء
        </p>
      )}
    </Card>
  );
}

/// قسمٌ يتوسّع.

export { KpiCard };
