import React from "react";
import { fmtMoney, fmtW } from "../core/money.js";
import { GoldEq } from "./GoldEq.jsx";

/// «قطعة واحدة · قطعتان · 3 قطع · 11 قطعة»
function piecesPhrase(n) {
  if (n === 1) return "قطعة واحدة";
  if (n === 2) return "قطعتان";
  if (n >= 3 && n <= 10) return `${n} قطع`;
  return `${n} قطعة`;
}

/// شريط الإجمالي أسفل الفاتورة: عدد القطع ووزنها بالعيار والإجمالي — ثابتٌ أمام البائع وهو يمسح
function SaleTotalsBar({ totals, currency = "ر.س", taxIncluded = false, commission = null }) {
  if (!totals || !(totals.pieces > 0)) return null;
  const many = totals.byKarat.length > 1;
  const only = totals.byKarat[0];
  return (
    <div data-sale-footer
      style={{ position: "sticky", bottom: -20, zIndex: 3, margin: "4px -20px 10px", padding: "10px 20px",
        background: "var(--panel)", borderTop: "1px solid var(--accentLine)", boxShadow: "0 -10px 18px -14px rgba(0,0,0,.55)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p style={{ color: "var(--text)", margin: 0 }} className="text-[13px] font-bold">
            <span data-sale-footer-pieces>{piecesPhrase(totals.pieces)}</span>
            {" · "}
            <span data-sale-footer-grams>{fmtW(totals.weight)} جم</span>
            {!many && only ? ` · عيار ${only.karat}` : ""}
          </p>
          {many && (
            <p data-sale-footer-karats style={{ color: "var(--text2)", margin: "2px 0 0" }} className="text-[11px]">
              {totals.byKarat.map((k) => `ع${k.karat}: ${fmtW(k.weight)} جم`).join(" · ")}
            </p>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: "end" }}>
          <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">{taxIncluded ? "الإجمالي شامل الضريبة" : "الإجمالي"}</p>
          <p data-sale-footer-total style={{ color: "var(--accent)", margin: 0, fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold whitespace-nowrap">
            {fmtMoney(totals.total)} {currency}<GoldEq v={totals.total} />
          </p>
        </div>
      </div>
      {commission && commission.show && (
        <p data-sale-footer-commission style={{ color: "var(--text2)", margin: "4px 0 0" }} className="text-[11px]">
          عمولتك من هذه الفاتورة ≈ <b style={{ color: "var(--accent)" }}>{fmtMoney(commission.invoice)} {currency}</b>
          {" · "}هذا الشهر {fmtMoney(commission.month)} {currency} من {commission.count} فاتورة
          {commission.target > 0 && !commission.metTarget ? ` · بقي للهدف ${fmtMoney(commission.toTarget)} ${currency}` : ""}
        </p>
      )}
      {totals.unpricedPieces > 0 && (
        <p data-sale-footer-unpriced style={{ color: "var(--bad)", margin: "2px 0 0" }} className="text-[11px]">
          بلا سعرٍ بعد: {piecesPhrase(totals.unpricedPieces)} — لا تدخل الإجمالي
        </p>
      )}
    </div>
  );
}

export { SaleTotalsBar, piecesPhrase };
