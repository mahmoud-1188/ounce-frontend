import React, { useEffect, useMemo, useState } from "react";
import { fmtMoney } from "../core/money.js";
import { inputStyle, monthRange, networkFeesRecorded } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

/// نموذج تسوية عمولة البنك.
///   يعرض المسجَّل في الدفتر للمدّة، يأخذ الفعليّ من كشف البنك، ويُظهر الفرق قبل الإرسال.
///
/// ⚠ المسجَّل من الخادم (`onFetch`) لا من اليومية المحمّلة: bootstrap يقصّ
///   القيود القديمة، فشهرٌ سابق يُحسب ناقصًا ويُسوّى بفرقٍ خاطئ. اليومية
///   المحلية تقديرٌ حتى يصل الرقم الفعلي فقط.
function BankFeeSettlementForm({ journal = [], adjustments = [], networkBalance = null, currency = "ر.س", canSettle = true, onFetch = null, onSubmit }) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(thisMonth);
  const [actual, setActual] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState(null);     // { period, recorded, adjustments }
  const { from, to } = monthRange(period);
  const local = useMemo(() => networkFeesRecorded(journal, from, to), [journal, from, to]);
  useEffect(() => {
    let live = true;
    setServer(null);
    if (onFetch && /^\d{4}-\d{2}$/.test(period)) {
      onFetch(period).then((d) => { if (live && d) setServer(d); }).catch(() => {});
    }
    return () => { live = false; };
  }, [period]);
  const recorded = server && server.period === period ? server.recorded : local;
  const list = server?.adjustments || adjustments || [];
  const diff = Math.round(((Number(actual) || 0) - recorded) * 100) / 100;
  const done = list.find((a) => a.period === period);
  const ready = actual !== "" && !done && !busy && canSettle;
  const submit = async () => {
    setBusy(true);
    try {
      const r = await onSubmit({ period, actualFee: Number(actual) || 0, note });
      if (r) {
        setActual(""); setNote("");
        if (onFetch) onFetch(period).then((d) => d && setServer(d)).catch(() => {});
      }
    } finally { setBusy(false); }
  };
  return (
    <>
      <Card style={{ padding: 12, marginBottom: 10 }}>
        <div className="grid grid-cols-2 gap-2">
          <Field label="الشهر"><input type="month" style={inputStyle} value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
          <Field label={`العمولة الفعلية من كشف البنك (${currency})`}><NumericInput value={actual} onChange={setActual} placeholder="0.00" /></Field>
        </div>
        <div className="flex items-center justify-between py-1"><span style={{ color: "var(--text2)" }} className="text-[11px]">المسجَّل في الدفتر (6500) للشهر{server ? "" : " — تقدير"}</span><span style={{ color: "var(--text)" }} className="text-xs font-bold">{currency}{fmtMoney(recorded)}</span></div>
        {actual !== "" && (
          <div className="flex items-center justify-between py-1" style={{ borderTop: "1px solid var(--line)" }}>
            <span style={{ color: "var(--text)" }} className="text-xs font-bold">{diff > 0 ? "يُخصم من رصيد الشبكة" : diff < 0 ? "يُردّ إلى رصيد الشبكة" : "مطابق"}</span>
            <span style={{ color: diff > 0 ? "var(--bad)" : diff < 0 ? "var(--good)" : "var(--text2)" }} className="text-sm font-extrabold">{currency}{fmtMoney(Math.abs(diff))}</span>
          </div>
        )}
        {networkBalance != null && diff > 0 && diff > networkBalance + 0.005 && <p style={{ color: "var(--bad)" }} className="text-[11px]">⚠ رصيد الشبكة {fmtMoney(networkBalance)} لا يكفي</p>}
        {done && <p style={{ color: "var(--accentText)" }} className="text-[11px]">⚠ {period} مسوًّى سلفًا: فعليّ {fmtMoney(done.actual)} · فرق {fmtMoney(done.diff)} · {done.by}</p>}
        <Field label="ملاحظة (اختياري)"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="رقم كشف البنك · سبب الاختلاف" /></Field>
        <button disabled={!ready} onClick={submit}
          className="w-full py-2.5 rounded-xl text-xs font-bold"
          style={{ background: ready ? "linear-gradient(135deg, var(--gradFrom), var(--gradTo))" : "var(--field)", color: ready ? "var(--bg)" : "var(--text3)" }}>
          {busy ? "جارٍ التسوية…" : "تسوية الشهر"}
        </button>
        {!canSettle && <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">⚖ التسوية بيد المدير — والاطّلاع للجميع.</p>}
        <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">⚖ الفرق يُقيَّد على 6500 عمولات الشبكة والبنوك ويُخصم من (أو يُردّ إلى) رصيد الشبكة — مرّةً واحدة لكل شهر.</p>
      </Card>
      {list.length > 0 && (
        <>
          <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">التسويات السابقة</p>
          {list.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--line)" }}>
              <span style={{ color: "var(--text2)" }} className="text-[11px]">{a.period} · مسجَّل {fmtMoney(a.recorded)} · فعليّ {fmtMoney(a.actual)} · {a.by}</span>
              <span style={{ color: a.diff > 0 ? "var(--bad)" : a.diff < 0 ? "var(--good)" : "var(--text3)" }} className="text-[11px] font-bold">{a.diff > 0 ? "−" : a.diff < 0 ? "+" : ""}{fmtMoney(Math.abs(a.diff))}</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}

export { BankFeeSettlementForm };
