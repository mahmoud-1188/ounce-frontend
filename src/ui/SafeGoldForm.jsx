import React, { useState } from "react";
import { KARATS, PURITY, fmt } from "../core/money.js";
import { GOLD_OUT_DESTINATIONS } from "../core/workflow.js";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";

// ⚠ إصلاح محلي: كان النموذج يحسب destOptions/destObj/needsSupplier
// ولا يعرض أبدًا قائمة اختيار الوجهة ولا المورد، ولا يمرّرهما إلى
// onSubmit — فكل سحب ذهب خام كان يفترض ضمنيًا "مورد" بلا مورد
// فعلي، فتفشل تسوية حساب المورد في handleAddSafeGoldTx صامتة.
function SafeGoldForm({ onCancel, onSubmit, suppliers = [] }) {
  const [type, setType] = useState("in"); // 'in' | 'out'
  const [kind, setKind] = useState("raw"); // 'raw' | 'crafted'
  const [karat, setKarat] = useState(21);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState("supplier");
  const [supplierId, setSupplierId] = useState("");

  const destOptions = GOLD_OUT_DESTINATIONS[kind === "raw" ? "raw" : "crafted"];
  const destObj = destOptions.find((d) => d.id === destination) || destOptions[0];
  const needsSupplier = type === "out" && destObj?.needsSupplier;
  // الوجهة إلزامية عند السحب: وزن يخرج بلا وجهة مسجّلة يستحيل تتبّعه.
  const valid = Number(weight) > 0 && (type === "in" || (!!destination && (!needsSupplier || !!supplierId)));

  // تبديل النوع يغيّر الوجهات المتاحة، فتُعاد للأولى المناسبة.
  const switchKind = (k) => {
    setKind(k);
    setDestination(k === "raw" ? "supplier" : "display");
    setSupplierId("");
  };

  return (
    <Card style={{ padding: 12, marginBottom: 16 }}>
      <Field label="نوع الحركة">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setType("in")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: type === "in" ? "var(--accentBg)" : "var(--bg)", color: type === "in" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            إيداع
          </button>
          <button
            onClick={() => setType("out")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: type === "out" ? "var(--accentBg)" : "var(--bg)", color: type === "out" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            سحب
          </button>
        </div>
      </Field>
      <Field label="نوع الذهب">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => switchKind("raw")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: kind === "raw" ? "var(--accentBg)" : "var(--bg)", color: kind === "raw" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            غير مشغول (خام)
          </button>
          <button
            onClick={() => switchKind("crafted")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: kind === "crafted" ? "var(--accentBg)" : "var(--bg)", color: kind === "crafted" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            مشغول (قطع)
          </button>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="العيار">
          <select style={inputStyle} value={karat} onChange={(e) => setKarat(Number(e.target.value))}>
            {KARATS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الوزن (جرام)">
          <input style={inputStyle} type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(sanitizeNumeric(e.target.value))} placeholder="0.00" />
        </Field>
      </div>
      {Number(weight) > 0 && (
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
          يعادل {fmt(Number(weight) * (PURITY[karat] || 1))} جم بعيار 24
        </p>
      )}
      {type === "out" && (
        <Field label="الوجهة">
          <select
            style={inputStyle}
            value={destination}
            onChange={(e) => { setDestination(e.target.value); setSupplierId(""); }}
          >
            {destOptions.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          {destObj?.hint && (
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">{destObj.hint}</p>
          )}
        </Field>
      )}
      {needsSupplier && (
        <Field label="المورد">
          <select style={inputStyle} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">اختر المورد...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="ملاحظة (اختياري)">
        <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={!valid}
          onClick={() => onSubmit(type, kind, weight, note, karat, type === "out" ? destination : null, needsSupplier ? supplierId : null)}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
        >
          حفظ
        </button>
      </div>
    </Card>
  );
}

/// الفئات التي لا تقوم بلا شريك مُسمّى.
///
/// ⚠ حقوق الملكية ملكُ أحدٍ بعينه. مساهمةٌ بلا مساهم تُنشئ رصيدًا في
/// حساب 3100 لا يُعرف صاحبه، وعند التصفية يطالب به أكثر من واحد أو
/// لا يطالب به أحد.
///
/// وكذلك السحب والتوزيع: من سحب؟ ومن أخذ حصّته؟

export { SafeGoldForm };
