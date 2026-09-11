import React, { useState } from "react";
import { MANUAL_ACCOUNT_TREE } from "../core/constants.js";
import { METHODS, METHOD_LABELS } from "../core/money-rules.js";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";

function SimpleAmountForm({ onCancel, onSubmit, submitLabel, withMethod = false, direction = "in", hideCategory = false }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("cash");
  const options = direction === "in" ? MANUAL_ACCOUNT_TREE.in : MANUAL_ACCOUNT_TREE.out;
  const [category, setCategory] = useState(options[0].id);
  const valid = Number(amount) > 0;
  return (
    <Card style={{ padding: 12, marginBottom: 16 }}>
      {!hideCategory && (
        <Field label="التصنيف المحاسبي">
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {withMethod && (
        <Field label="الطريقة">
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className="py-2 rounded-xl text-xs font-bold"
                style={{ background: method === m ? "var(--accentBg)" : "var(--bg)", color: method === m ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
              >
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="المبلغ">
        <input style={inputStyle} type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeNumeric(e.target.value))} placeholder="0.00" />
      </Field>
      <Field label="ملاحظة (اختياري)">
        <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={!valid}
          onClick={() => onSubmit(amount, note, method, category)}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
        >
          {submitLabel}
        </button>
      </div>
    </Card>
  );
}

export { SimpleAmountForm };
