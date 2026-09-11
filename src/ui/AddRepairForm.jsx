import React, { useState } from "react";
import { fmtMoney } from "../core/money.js";
import { FUNDING_SOURCES } from "../core/workflow.js";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";

function AddRepairForm({ onCancel, onSave }) {
  const [customerName, setCustomerName] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [profit, setProfit] = useState("");
  const [fundingSource, setFundingSource] = useState("daily_cash");
  const [notes, setNotes] = useState("");
  const valid = Number(profit) >= 0;
  const total = (Number(cost) || 0) + (Number(profit) || 0);

  return (
    <Card style={{ padding: 14, marginBottom: 16 }}>
      <Field label="اسم العميل (اختياري)">
        <input style={inputStyle} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
      </Field>
      <Field label="وصف الإصلاح">
        <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="مثال: تقصير سوار" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="التكلفة">
          <input style={inputStyle} type="text" inputMode="decimal" value={cost} onChange={(e) => setCost(sanitizeNumeric(e.target.value))} placeholder="0.00" />
        </Field>
        <Field label="المكسب">
          <input style={inputStyle} type="text" inputMode="decimal" value={profit} onChange={(e) => setProfit(sanitizeNumeric(e.target.value))} placeholder="0.00" />
        </Field>
      </div>
      <Field label="يُضاف المكسب إلى">
        <select style={inputStyle} value={fundingSource} onChange={(e) => setFundingSource(e.target.value)}>
          {FUNDING_SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="ملاحظات (اختياري)">
        <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between py-2 mb-2" style={{ borderTop: "1px solid var(--edge)" }}>
        <span style={{ color: "var(--text2)" }} className="text-sm">
          إجمالي المحصَّل من العميل (تقريبي)
        </span>
        <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold">
          {fmtMoney(total)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={!valid}
          onClick={() => onSave({ customerName: customerName.trim(), description: description.trim(), cost, profit, fundingSource, notes: notes.trim() })}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
        >
          حفظ
        </button>
      </div>
    </Card>
  );
}

export { AddRepairForm };
