import React, { useEffect, useState } from "react";
import * as api from "../core/api.js";
import { fmtMoney, fmtW } from "../core/money.js";
import { Card } from "./Card.jsx";

const field = { background: "var(--field)", color: "var(--text)", border: "1px solid var(--line)" };

/// الجسر بين الدفترين وقياس نهاية الفترة (المرجع 5.2.0) — من الخادم وبالدفاتر كاملة.
/// ⚠ السعران يدخلهما المستخدم: سعر أوّل المدة لا يحفظه التطبيق، وسعر الإقفال افتراضًا سعر اليوم.
function IfrsBridgeCard({ price24 = 0, currency = "ر.س" }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [priceOpen, setPriceOpen] = useState("");
  const [priceClose, setPriceClose] = useState(price24 ? String(price24) : "");
  const [bridge, setBridge] = useState(null);
  const [measure, setMeasure] = useState(null);
  const [err, setErr] = useState("");
  const m = (v) => `${fmtMoney(v)} ${currency}`;

  useEffect(() => {
    let live = true;
    setErr("");
    const pc = Number(priceClose) || 0;
    Promise.all([
      api.fetchIfrsBridge({ from, to, priceOpen: Number(priceOpen) || pc, priceClose: pc }),
      api.fetchIfrsMeasurement({ asOf: to, price24: pc }),
    ]).then(([b, ms]) => { if (live) { setBridge(b); setMeasure(ms); } })
      .catch((e) => { if (live) setErr(String(e?.message || "تعذّر الحساب")); });
    return () => { live = false; };
  }, [from, to, priceOpen, priceClose]);

  const noPrice = !(Number(priceClose) > 0);
  return (
    <>
      <Card style={{ padding: 12, marginBottom: 10 }}>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px]" style={{ color: "var(--text3)" }}>من
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full px-2 py-1.5 rounded-lg text-[12px]" style={field} /></label>
          <label className="text-[10px]" style={{ color: "var(--text3)" }}>إلى
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-2 py-1.5 rounded-lg text-[12px]" style={field} /></label>
          <label className="text-[10px]" style={{ color: "var(--text3)" }}>سعر جم24 أوّل المدة
            <input inputMode="decimal" value={priceOpen} placeholder="= سعر الإقفال" onChange={(e) => setPriceOpen(e.target.value)} className="w-full px-2 py-1.5 rounded-lg text-[12px]" style={field} /></label>
          <label className="text-[10px]" style={{ color: "var(--text3)" }}>سعر جم24 الإقفال
            <input inputMode="decimal" value={priceClose} onChange={(e) => setPriceClose(e.target.value)} className="w-full px-2 py-1.5 rounded-lg text-[12px]" style={field} /></label>
        </div>
        {noPrice && <p className="text-[11px] mt-2" style={{ color: "var(--accent)" }}>⚠ أدخل سعر الإقفال — بلا سعرٍ لا يُقاس الذهب بالريال.</p>}
        {err && <p className="text-[11px] mt-2" style={{ color: "var(--bad)" }}>{err}</p>}
      </Card>

      {bridge && (
        <Card style={{ padding: 12, marginBottom: 10 }}>
          <p style={{ color: "var(--accent)", margin: "0 0 2px" }} className="text-xs font-bold">الجسر بين الدفترين (IFRS 18)</p>
          <p style={{ color: "var(--text3)", margin: "0 0 6px" }} className="text-[10px]">
            من مكسبك بالوزن إلى النتيجة وفق المعايير الدولية — المملوك {fmtW(bridge.ownedOpen)} ← {fmtW(bridge.ownedClose)} جم24
            {Math.abs(bridge.goldFlows) > 0.0005 ? ` · تدفّقات ملكية ${fmtW(bridge.goldFlows)} جم24` : ""}
          </p>
          <div className="flex justify-between py-1 text-[12px] font-bold" style={{ color: "var(--text)" }}>
            <span>المكسب بالوزن</span><span>{fmtW(bridge.gainFine)} جم24</span>
          </div>
          {bridge.lines.map((l) => (
            <div key={l.key} className="py-1" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="flex justify-between text-[12px]" style={{ color: "var(--text2)" }}><span>{l.label}</span><span>{m(l.amount)}</span></div>
              {l.hint && <p className="text-[10px]" style={{ color: "var(--text3)", margin: 0 }}>{l.hint}</p>}
            </div>
          ))}
          <div className="flex justify-between py-1.5 text-[12px] font-extrabold" style={{ borderTop: "2px solid var(--line)", color: "var(--text)" }}>
            <span>= النتيجة وفق IFRS</span><span>{m(bridge.total)}</span>
          </div>
          <p className="text-[11px]" style={{ color: bridge.reconciles ? "var(--good)" : "var(--bad)", margin: 0 }}>
            {bridge.reconciles
              ? `✓ يطابق صافي الدخل في الأستاذ (${m(bridge.ifrsProfit)})`
              : `✗ فرق ${m(bridge.difference)} عن صافي الدخل في الأستاذ (${m(bridge.ifrsProfit)}) — راجع «صحة الدفتر» في الأستاذ العام`}
          </p>
        </Card>
      )}

      {measure && (
        <Card style={{ padding: 12, marginBottom: 10 }}>
          <p style={{ color: "var(--accent)", margin: "0 0 2px" }} className="text-xs font-bold">قياس نهاية الفترة (IAS 2)</p>
          <p style={{ color: "var(--text3)", margin: "0 0 6px" }} className="text-[10px]">
            المخزون بالأقل من التكلفة والقيمة البيعية — في {to}. عرضٌ للمراجع، لا يُكتب منه قيد.
          </p>
          {measure.rows.length === 0 && <p className="text-[11px]" style={{ color: "var(--text3)" }}>لا ذهب في المخزون في هذا التاريخ.</p>}
          {measure.rows.map((r) => (
            <div key={r.code} className="py-1.5" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="flex justify-between text-[12px]" style={{ color: "var(--text)" }}>
                <span className="font-bold">{r.code} {r.name}</span><span>{fmtW(r.fine)} جم24</span>
              </div>
              <div className="flex justify-between text-[11px]" style={{ color: "var(--text2)" }}>
                <span>بالتكلفة {m(r.book)}{r.perGram != null ? ` · ${m(r.perGram)}/جم` : ""}</span><span>بالسوق {m(r.market)}</span>
              </div>
              {r.writeDown > 0 && <p className="text-[11px]" style={{ color: "var(--bad)", margin: 0 }}>تخفيضٌ مقترح {m(r.writeDown)} — التكلفة أعلى من السوق</p>}
              {r.mismatch && <p className="text-[11px]" style={{ color: "var(--accent)", margin: 0 }}>⚠ وزنٌ بلا قيمة أو قيمةٌ بلا وزن — الدفتران لا يتّفقان في هذا الحساب</p>}
            </div>
          ))}
          {measure.rows.length > 0 && (
            <div className="flex justify-between py-1.5 text-[12px] font-extrabold" style={{ borderTop: "2px solid var(--line)", color: measure.writeDown > 0 ? "var(--bad)" : "var(--good)" }}>
              <span>{measure.writeDown > 0 ? "التخفيض المقترح إلى 1295" : "✓ لا تخفيض — السوق فوق التكلفة"}</span>
              {measure.writeDown > 0 && <span>{m(measure.writeDown)}</span>}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

export { IfrsBridgeCard };
