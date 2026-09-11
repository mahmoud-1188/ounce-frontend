import React, { useState } from "react";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

function AddPartnerForm({ onCancel, onSubmit }) {
  const [name, setName] = useState("");
  const [share, setShare] = useState("");
  const [phone, setPhone] = useState("");
  const valid = name.trim().length > 0;
  return (
    <Card style={{ padding: 14, marginBottom: 16 }}>
      <Field label="اسم الشريك">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="رأس المال المُدخل (جرام عيار 24)">
          <NumericInput value={share} onChange={setShare} placeholder="0.00" />
        </Field>
        <Field label="جوال (اختياري)">
          <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
        نسبة الشراكة تُحسب تلقائيًا من حصة رأس ماله في إجمالي رأس مال الشركاء، وتتغيّر مع كل مساهمة أو سحب — فلا تُدخَل يدويًا.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={!valid}
          onClick={() => onSubmit(name, share, phone)}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
        >
          إضافة
        </button>
      </div>
    </Card>
  );
}

export { AddPartnerForm };
