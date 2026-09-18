import React from "react";
import { fmtMoney, fmtW } from "../core/money.js";
import { goldProfit } from "../domain/helpers.js";
import { Card } from "./Card.jsx";

function GoldPositionCard({ position, opening, label = "المركز الذهبي" }) {
  if (!position) return null;
  const pr = opening ? goldProfit(opening, position) : null;
  const g = (v) => `${fmtW(v || 0)} جم24`;
  const row = (l, v, tone) => (
    <div key={l} className="flex items-baseline justify-between py-0.5">
      <span style={{ color: "var(--text3)" }} className="text-[10px]">{l}</span>
      <span style={{ color: tone || "var(--text2)" }} className="text-[11px]">{g(v)}</span>
    </div>
  );
  return (
    <Card style={{ padding: 14, marginBottom: 12,
      background: "linear-gradient(160deg,var(--panel) 0%,var(--bg) 100%)",
      border: "1px solid var(--accentLine)" }}>
      <p style={{ color: "var(--accent)", margin: 0 }} className="text-[11px] font-bold">{label}</p>
      <p style={{ color: "var(--text)", margin: "4px 0 0", fontVariantNumeric: "tabular-nums" }}
        className="text-[26px] font-black">
        {fmtW(position.net)} <span className="text-[13px] font-bold" style={{ color: "var(--text3)" }}>جم24</span>
      </p>
      {position.priceMissing && (
        <p style={{ color: "var(--bad)", margin: "2px 0 0" }} className="text-[10px]">
          ⚠ لا سعر — النقد لم يُحسب
        </p>
      )}

      {pr && (
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12,
          background: pr.grams >= 0 ? "var(--goodBg)" : "var(--badBg)",
          border: `1px solid ${pr.grams >= 0 ? "var(--goodLine)" : "var(--badLine)"}` }}>
          <div className="flex items-baseline justify-between">
            <span style={{ color: pr.grams >= 0 ? "var(--good)" : "var(--bad)" }} className="text-[11px] font-bold">
              {pr.grams >= 0 ? "ربح السنة" : "خسارة السنة"}
            </span>
            <span style={{ color: pr.grams >= 0 ? "var(--good)" : "var(--bad)" }} className="text-[16px] font-black">
              {pr.grams >= 0 ? "+" : ""}{fmtW(pr.grams)} جم{pr.pct !== null ? ` · ${pr.pct}٪` : ""}
            </span>
          </div>
          <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px] leading-5">
            من {g(pr.openingNet)} إلى {g(pr.closingNet)}
          </p>
          {/* ⚠ التفكيك للفهم لا للقيد: كلاهما ربحٌ بالجرام، لكن المالك يريد أن
              يعرف أزاد ذهبه بالتجارة أم بحركة السعر على النقد الذي أمسكه. */}
          {Math.abs(pr.priceEffectGrams) >= 0.001 && (
            <div className="mt-1.5" style={{ borderTop: "1px solid var(--line)", paddingTop: 6 }}>
              {row("من التجارة", pr.tradingGrams, pr.tradingGrams >= 0 ? "var(--good)" : "var(--bad)")}
              {row("من حركة السعر على النقد", pr.priceEffectGrams, pr.priceEffectGrams >= 0 ? "var(--good)" : "var(--bad)")}
            </div>
          )}
        </div>
      )}

      <details className="mt-2">
        <summary style={{ color: "var(--text3)" }} className="text-[10px]">التفصيل</summary>
        <div className="mt-1">
          <p style={{ color: "var(--accentText)", margin: "4px 0 2px" }} className="text-[10px] font-bold">ذهبٌ مادي</p>
          {row("مخزون مشغول", position.physical?.inventory)}
          {row("كسر", position.physical?.scrap)}
          {position.physical?.atOffices > 0 && row("لدى المكاتب", position.physical.atOffices)}
          {position.physical?.inTransit > 0 && row("بالطريق", position.physical.inTransit)}
          {position.goldOwed?.total > 0 && (<>
            <p style={{ color: "var(--accentText)", margin: "6px 0 2px" }} className="text-[10px] font-bold">عليك ذهبًا</p>
            {position.goldOwed.suppliers > 0 && row("للمورّدين", -position.goldOwed.suppliers, "var(--bad)")}
            {position.goldOwed.offices > 0 && row("للمكاتب", -position.goldOwed.offices, "var(--bad)")}
            {position.goldOwed.customers > 0 && row("أمانات العملاء", -position.goldOwed.customers, "var(--bad)")}
          </>)}
          <p style={{ color: "var(--accentText)", margin: "6px 0 2px" }} className="text-[10px] font-bold">
            النقد وما في حكمه — بسعر {fmtMoney(position.price24)}
          </p>
          {row("نقد", position.cashSide?.cash)}
          {position.cashSide?.receivables > 0 && row("ذمم عملاء", position.cashSide.receivables)}
          {position.cashSide?.payables < 0 && row("أجور مستحقة", position.cashSide.payables, "var(--bad)")}
          <div className="flex items-baseline justify-between mt-1.5 pt-1.5" style={{ borderTop: "1px solid var(--line)" }}>
            <span style={{ color: "var(--text2)" }} className="text-[10px] font-bold">ذهبٌ مملوك (بلا نقد)</span>
            <span style={{ color: "var(--text)" }} className="text-[11px] font-bold">{g(position.ownedGold)}</span>
          </div>
        </div>
      </details>
    </Card>
  );
}


/// المجموعة الكاملة للقوائم المالية — ما يُسلَّم للمدير المالي.

/// كشفٌ لأي شيء — اختر النوع ثم الاسم.

/// الدورة المستندية — شاشةٌ يقرؤها الموظّف وPDF يُسلَّم للمراجع.

export { GoldPositionCard };
