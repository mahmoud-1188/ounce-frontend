import React, { useState } from "react";
import { inputStyle } from "../domain/helpers.js";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

/**
 * منقول عن HrFieldsForm.js المرجعي — onSave أصبح async (نفس فرق
 * AssetForm.jsx المشروح هناك): يحفظ على PATCH /api/hr/staff/:id
 * الفعلي، ولا يُغلق النموذج إلا بعد نجاح مؤكَّد.
 */
function HrFieldsForm({ user, onCancel, onSave }) {
  const [f, setF] = useState({
    basicSalary: String(user.basicSalary ?? ""),
    housing: user.housing != null ? String(user.housing) : "",
    transport: String(user.transport ?? ""),
    otherAllowance: String(user.otherAllowance ?? ""),
    nationality: user.nationality || "saudi",
    hireDate: user.hireDate ? String(user.hireDate).slice(0, 10) : "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function submit() {
    setSaving(true);
    const ok = await onSave({
      basicSalary: Number(f.basicSalary) || 0,
      housing: f.housing === "" ? "" : Number(f.housing) || 0,
      transport: Number(f.transport) || 0, otherAllowance: Number(f.otherAllowance) || 0,
      nationality: f.nationality, hireDate: f.hireDate || null,
    });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="الأساسي"><NumericInput value={f.basicSalary} onChange={set("basicSalary")} /></Field>
        <Field label="بدل سكن (فارغ = 25٪)"><NumericInput value={f.housing} onChange={set("housing")} /></Field>
        <Field label="مواصلات"><NumericInput value={f.transport} onChange={set("transport")} /></Field>
        <Field label="بدلات أخرى"><NumericInput value={f.otherAllowance} onChange={set("otherAllowance")} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[["saudi", "سعودي"], ["expat", "غير سعودي"]].map(([id, lbl]) => (
          <button key={id} onClick={() => set("nationality")(id)} className="py-2 rounded-xl text-[11px] font-bold"
            style={{ background: f.nationality === id ? "var(--accentBg)" : "var(--field)", color: f.nationality === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{lbl}</button>
        ))}
      </div>
      <Field label="تاريخ التعيين"><input type="date" style={inputStyle} value={f.hireDate} onChange={(e) => set("hireDate")(e.target.value)} /></Field>
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={saving} className="flex-1 py-2 rounded-xl text-[11px]" style={{ background: "var(--field)", color: "var(--text2)" }}>إلغاء</button>
        <button onClick={submit} disabled={saving} className="flex-1 py-2 rounded-xl text-[11px] font-bold" style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      </div>
    </div>
  );
}

export { HrFieldsForm };
