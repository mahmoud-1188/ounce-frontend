import React, { useState } from "react";
import { fmtW } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Card } from "./Card.jsx";

function RefineScrapForm({ estimate, onCancel, onSubmit }) {
  const [actual, setActual] = useState(String(estimate));
  const valid = Number(actual) >= 0;
  const surplus = Math.max(0, estimate - Number(actual || 0));
  return (
    <Card style={{ padding: 10, marginTop: 10, background: "var(--bg)" }}>
      <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
        الوزن الفعلي للفصوص بعد التكسير (المقدَّر كان {fmtW(estimate)} جم)
      </p>
      <input style={{ ...inputStyle, marginBottom: 8 }} type="text" inputMode="decimal" value={actual} onChange={(e) => setActual(sanitizeNumeric(e.target.value))} />
      {surplus > 0 && (
        <p style={{ color: "var(--good)" }} className="text-[11px] mb-2">
          فائض ذهب متوقع: +{fmtW(surplus)} جم
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={!valid}
          onClick={() => onSubmit(actual)}
          className="py-1.5 rounded-lg text-xs font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
        >
          تأكيد التصفية
        </button>
      </div>
    </Card>
  );
}

export { RefineScrapForm };
