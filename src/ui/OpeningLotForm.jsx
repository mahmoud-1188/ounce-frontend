import React, { useState } from "react";
import { KARATS, fmt, pricePerGram } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

/// دفعة افتتاحية جديدة — بلا مورد: عيار + تكلفة الجرام، وموسومة بمرجعها
/// (تكلفة شراء فعلية أم سعرٌ عالمي اختير حين فُقدت التكلفة).
function OpeningLotForm({ onCancel, onCreate, price24 = 0, currency = "ر.س" }) {
  const [karat, setKarat] = useState(21);
  const [costRef, setCostRef] = useState("purchase");   // purchase | market
  const [costPerGram, setCostPerGram] = useState("");
  const [busy, setBusy] = useState(false);
  const marketFor = (k) => { const p = pricePerGram(k, price24); return p > 0 ? String(Math.round(p * 100) / 100) : ""; };
  const setK = (k) => {
    setKarat(k);
    if (costRef === "market") setCostPerGram(marketFor(k));
  };
  const setRef = (r) => {
    setCostRef(r);
    setCostPerGram(r === "market" ? marketFor(karat) : "");
  };
  const valid = Number(costPerGram) > 0 && !busy;
  const submit = async () => {
    setBusy(true);
    try { await onCreate({ karat, costPerGram: Number(costPerGram), costRef }); } finally { setBusy(false); }
  };
  return (
    <Card style={{ padding: 12, marginBottom: 16 }}>
      <p style={{ color: "var(--text2)" }} className="text-xs mb-2">دفعة افتتاحية جديدة — بلا مورد</p>
      <Field label="مرجع التكلفة">
        <div className="grid grid-cols-2 gap-1.5">
          {[["purchase", "تكلفة الشراء الفعلية", "الأصل — من فواتيرك"], ["market", "السعر العالمي اليوم", "حين تُفقد التكلفة"]].map(([id, l, h]) => (
            <button key={id} type="button" onClick={() => setRef(id)} className="text-right rounded-xl p-2"
              style={{ background: costRef === id ? "var(--accentBg)" : "var(--field)", border: `1px solid ${costRef === id ? "var(--accentLine)" : "var(--edge)"}` }}>
              <p style={{ color: costRef === id ? "var(--accent)" : "var(--text)", margin: 0 }} className="text-[11px] font-bold">{l}</p>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">{h}</p>
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="العيار">
          <select style={inputStyle} value={karat} onChange={(e) => setK(Number(e.target.value))}>
            {KARATS.filter((k) => k !== 14).map((k) => (<option key={k} value={k}>{k}</option>))}
          </select>
        </Field>
        <Field label={costRef === "market" ? `السعر العالمي للجرام (${currency})` : `تكلفة الجرام (${currency})`}>
          <NumericInput value={costPerGram} onChange={setCostPerGram} placeholder="0.00" />
        </Field>
      </div>
      <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
        {costRef === "market"
          ? `⚠ تقييمٌ بسعر اليوم لا بتكلفة شراء — يُوسم على الدفعة وتقاريرها. (سعر جم24 اليوم ${currency}${fmt(price24, 2)})`
          : `يُقيَّد ما يُكوَّد بهذه التكلفة مخزونًا مقابل رأس المال. للمقارنة: سعر جم${karat} اليوم ${currency}${fmt(pricePerGram(karat, price24), 2)}.`}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold"
          style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
        <button disabled={!valid} onClick={submit}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: valid ? "var(--accentBg)" : "var(--field)", color: valid ? "var(--accent)" : "var(--text3)", border: "1px solid var(--accentLine)" }}>
          {busy ? "جارِ الإنشاء…" : "إنشاء الدفعة"}
        </button>
      </div>
    </Card>
  );
}

export { OpeningLotForm };
