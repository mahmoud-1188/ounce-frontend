import React, { useState } from "react";
import { inputStyle } from "../domain/helpers.js";
import { Field } from "./Field.jsx";

/// ملف الموظف (migration 058): الهوية والإقامة والجواز والعقد والبنك — للمدير
const FIELDS = [
  ["jobTitle", "المسمّى الوظيفي"], ["department", "القسم"], ["nationalId", "الهوية الوطنية"], ["iqamaNo", "رقم الإقامة"],
  ["iqamaExpiry", "انتهاء الإقامة", "date"], ["passportNo", "رقم الجواز"], ["passportExpiry", "انتهاء الجواز", "date"],
  ["contractType", "نوع العقد"], ["contractStart", "بداية العقد", "date"], ["contractEnd", "نهاية العقد", "date"],
  ["probationEnd", "نهاية التجربة", "date"], ["gosiNo", "رقم التأمينات"], ["bankName", "البنك"], ["iban", "الآيبان (SA…)"],
  ["phone", "الجوال"], ["email", "البريد"], ["emergencyContact", "جهة اتصال للطوارئ"],
];

function HrProfileForm({ profile = {}, onCancel, onSave }) {
  const [f, setF] = useState(() => Object.fromEntries(FIELDS.map(([k]) => [k, profile?.[k] || ""])));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setSaving(true); setErr("");
    const r = await onSave(f);
    setSaving(false);
    if (r === true) onCancel(); else if (typeof r === "string") setErr(r);
  };
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map(([k, l, t]) => (
          <Field key={k} label={l}>
            <input type={t || "text"} style={inputStyle} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} />
          </Field>
        ))}
      </div>
      {err && <p className="text-[11px] mb-1" style={{ color: "var(--bad)" }}>{err}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={saving} className="flex-1 py-2 rounded-xl text-[11px]" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
        <button onClick={submit} disabled={saving} className="flex-1 py-2 rounded-xl text-[11px] font-bold" style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
          {saving ? "جارٍ الحفظ…" : "حفظ الملف"}
        </button>
      </div>
    </div>
  );
}

export { HrProfileForm };
