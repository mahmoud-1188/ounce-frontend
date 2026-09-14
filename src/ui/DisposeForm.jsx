import React, { useState } from "react";
import { fmtMoney, fromHalalas, halalas } from "../core/money.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

/**
 * منقول عن DisposeForm.js المرجعي — نفس فرق onConfirm الآن async
 * المشروح في AssetForm.jsx (المرجع لا يحتاج funding source إلا عند
 * البيع، تمامًا كما هنا).
 */
function DisposeForm({ asset, status, currency, onCancel, onConfirm }) {
  const [reason, setReason] = useState("sale");
  const [proceeds, setProceeds] = useState("");
  const [source, setSource] = useState("safe_cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const cash = reason === "sale" ? Number(proceeds) || 0 : 0;
  const gain = fromHalalas(halalas(cash) - halalas(status.bookValue));

  async function submit() {
    setError("");
    setSaving(true);
    const ok = await onConfirm({ proceeds: cash, fundingSource: cash > 0 ? source : undefined, reason });
    setSaving(false);
    if (!ok) setError("تعذّر تنفيذ الاستبعاد");
  }

  return (
    <div>
      <Card style={{ padding: 10, background: "var(--field)", marginBottom: 8 }}>
        {[["التكلفة", status.cost], ["مجمّع الإهلاك", status.accumulated], ["القيمة الدفترية", status.bookValue]].map(([l, v]) => (
          <div key={l} className="flex items-baseline justify-between py-1">
            <span style={{ color: "var(--text3)" }} className="text-[10px]">{l}</span>
            <span style={{ color: "var(--text)" }} className="text-[12px] font-bold">{currency}{fmtMoney(v)}</span>
          </div>
        ))}
      </Card>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {[["sale", "بيع"], ["scrap", "إتلاف / شطب"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setReason(id)} className="py-2 rounded-xl text-[11px] font-bold"
            style={{ background: reason === id ? "var(--accentBg)" : "var(--field)", color: reason === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{lbl}</button>
        ))}
      </div>
      {reason === "sale" && (
        <>
          <Field label={`المتحصّل ${currency}`}><NumericInput value={proceeds} onChange={setProceeds} /></Field>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[["safe_cash", "كاش"], ["safe_network", "شبكة"]].map(([id, lbl]) => (
              <button key={id} onClick={() => setSource(id)} className="py-2 rounded-xl text-[11px] font-bold"
                style={{ background: source === id ? "var(--accentBg)" : "var(--field)", color: source === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{lbl}</button>
            ))}
          </div>
        </>
      )}
      <Card style={{ padding: 10, marginBottom: 8, border: `1px solid ${gain >= 0 ? "var(--goodLine)" : "var(--badLine)"}` }}>
        <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">النتيجة</p>
        <p style={{ color: gain >= 0 ? "var(--good)" : "var(--bad)", margin: 0 }} className="text-[14px] font-bold">
          {gain >= 0 ? "ربح " : "خسارة "}{currency}{fmtMoney(Math.abs(gain))}
        </p>
        <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[10px]">المتحصّل {fmtMoney(cash)} − القيمة الدفترية {fmtMoney(status.bookValue)}</p>
      </Card>
      {error && <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[12px]" style={{ background: "var(--field)", color: "var(--text2)" }}>إلغاء</button>
        <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold"
          style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}>
          {saving ? "جارٍ التنفيذ…" : "تأكيد الاستبعاد"}
        </button>
      </div>
    </div>
  );
}

export { DisposeForm };
