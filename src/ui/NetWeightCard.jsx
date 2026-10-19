import React, { useState } from "react";
import { Scale, X } from "lucide-react";
import { fmtMoney, fmtW } from "../core/money.js";
import { Card } from "./Card.jsx";

/// بطاقة «صافي الفرع بالوزن» في الرئيسية — تُضغط فتظهر تفاصيلها وما يُفعل بكل سطر
function NetWeightCard({ pos, currency = "ر.س", onOpen }) {
  const [open, setOpen] = useState(false);
  if (!pos) return null;
  const K = pos.karat;
  const Row = ({ label, amount, grams, sign = "", go = null, sub = false }) => (
    <button type="button" disabled={!go} onClick={go || undefined} className="w-full flex items-center justify-between py-1.5 text-right"
      style={{ borderTop: "1px solid var(--line)" }}>
      <span style={{ color: sub ? "var(--text3)" : "var(--text2)", paddingInlineStart: sub ? 10 : 0 }} className="text-[12px]">{label}</span>
      <span style={{ color: "var(--text)" }} className="text-[12px] font-bold whitespace-nowrap">
        {amount != null ? `${fmtMoney(amount)} ${currency}` : ""}{grams != null ? ` · ${sign}${fmtW(grams)} جم` : ""}
      </span>
    </button>
  );
  return (
    <>
      <Card style={{ padding: 14, margin: "12px 16px" }} data-net-weight>
        <button type="button" onClick={() => setOpen(true)} className="w-full text-right">
          <span style={{ color: "var(--text2)" }} className="text-[11px] flex items-center gap-1"><Scale size={13} /> صافي الفرع بالوزن بعد الالتزامات · عيار {K}</span>
          <span style={{ fontFamily: "'Cairo', sans-serif", color: pos.net.grams >= 0 ? "var(--accent)" : "var(--bad)" }} className="text-2xl font-extrabold block" data-net-grams>
            {fmtW(pos.net.grams)} جم
          </span>
          <span style={{ color: "var(--text3)" }} className="text-[11px]">
            {pos.priceMissing ? "ضع سعر الذهب اليوم ليُحوَّل النقد وزنًا" : `ذهب ${fmtW(pos.gold.grams)} + نقد ${fmtW(pos.cash.grams)} − التزامات ${fmtW(pos.liabilities.grams)} · اضغط للتفصيل`}
          </span>
        </button>
      </Card>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "var(--veil)" }} onClick={() => setOpen(false)}>
          <div className="w-full rounded-t-3xl p-5" style={{ maxWidth: 448, background: "var(--panel)", maxHeight: "88dvh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()} data-net-weight-sheet>
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ color: "var(--text)" }} className="text-lg font-bold">صافي الفرع بالوزن · عيار {K}</h2>
              <button onClick={() => setOpen(false)} style={{ color: "var(--text2)" }}><X size={20} /></button>
            </div>
            <Row label="الذهب المملوك (مشغول وكسر بعد ما علينا للموردين)" grams={pos.gold.grams} go={onOpen ? () => onOpen("inventory") : null} />
            <Row label="النقد كلّه (كاش وشبكة) بسعر اليوم" amount={pos.cash.total} grams={pos.cash.grams} sign="+" go={onOpen ? () => onOpen("cash") : null} />
            {pos.cash.rows.map((r) => <Row key={r.code} sub label={`${r.code} ${r.name}`} amount={r.amount} />)}
            <Row label="الالتزامات حتى الآن" amount={pos.liabilities.total} grams={pos.liabilities.grams} sign="−" go={onOpen ? () => onOpen("expenses") : null} />
            {pos.liabilities.rows.map((r) => <Row key={r.code} sub label={`${r.code.startsWith("fx:") ? "" : r.code + " "}${r.name}`} amount={r.amount} />)}
            <div className="flex items-center justify-between py-2 mt-1" style={{ borderTop: "2px solid var(--accentLine)" }}>
              <span style={{ color: "var(--text)" }} className="text-sm font-bold">الصافي</span>
              <span style={{ color: pos.net.grams >= 0 ? "var(--accent)" : "var(--bad)" }} className="text-sm font-extrabold">{fmtW(pos.net.grams)} جم ≈ {fmtMoney(pos.net.value)} {currency}</span>
            </div>
            {pos.receivables.total > 0 && (
              <>
                <Row label="ما لنا عند الناس (الآجل والسلف) — لا يدخل الصافي" amount={pos.receivables.total} grams={pos.receivables.grams} go={onOpen ? () => onOpen("customers") : null} />
                <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">مع ما لنا عند الناس: {fmtW(pos.net.withReceivables)} جم</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export { NetWeightCard };
