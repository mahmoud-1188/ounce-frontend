import React, { useState } from "react";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";

function FundCustodyForm({ onCancel, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [source, setSource] = useState("daily"); // 'daily' | 'safe'
  const [note, setNote] = useState("");
  const valid = Number(amount) > 0;
  return (
    <Card style={{ padding: 12, marginBottom: 16 }}>
      <Field label="من">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSource("daily")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: source === "daily" ? "var(--accentBg)" : "var(--panel)", color: source === "daily" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            صندوق اليومي
          </button>
          <button
            onClick={() => setSource("safe")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: source === "safe" ? "var(--accentBg)" : "var(--panel)", color: source === "safe" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            الخزنة
          </button>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => setMethod("cash")}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: method === "cash" ? "var(--accentBg)" : "var(--panel)", color: method === "cash" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
        >
          نقدي
        </button>
        <button
          onClick={() => setMethod("network")}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: method === "network" ? "var(--accentBg)" : "var(--panel)", color: method === "network" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
        >
          شبكة
        </button>
      </div>
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
          onClick={() => onSubmit(amount, method, note, source, source === "safe" ? "transfer_from_safe" : "transfer_from_daily")}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
        >
          تمويل
        </button>
      </div>
    </Card>
  );
}

export { FundCustodyForm };
