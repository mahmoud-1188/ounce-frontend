import React, { useState } from "react";
import { fmtMoney } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

function CustodyOpenForm({ currency, onCancel, onSubmit }) {
  const [cash, setCash] = useState("");
  const [network, setNetwork] = useState("");
  const [note, setNote] = useState("");
  // ⚠ onSubmit صار نداء شبكة غير متزامن — بلا هذه الحالة كان الاستدعاء
  // المُغلِق للنموذج (المستدعي في WorkDayPage) يُغلقه فورًا بصرف النظر
  // عن نجاح الطلب.
  const [submitting, setSubmitting] = useState(false);
  const total = (Number(cash) || 0) + (Number(network) || 0);
  return (
    <Card style={{ padding: 12, marginTop: 10, background: "var(--bg)" }}>
      <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
        تُخصم العهدة من الخزنة وتُضاف لصندوق اليومي.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label={`نقدي (${currency})`}>
          <NumericInput value={cash} onChange={setCash} />
        </Field>
        <Field label={`شبكة (${currency})`}>
          <NumericInput value={network} onChange={setNetwork} />
        </Field>
      </div>
      <Field label="ملاحظة (اختياري)">
        <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between py-1.5 mb-2" style={{ borderTop: "1px solid var(--line)" }}>
        <span style={{ color: "var(--text2)" }} className="text-xs">
          إجمالي العهدة
        </span>
        <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
          {currency}
          {fmtMoney(total)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={total <= 0 || submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onSubmit(cash, network, note);
            } finally {
              setSubmitting(false);
            }
          }}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: total > 0 ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: total > 0 ? "var(--panel)" : "var(--text3)" }}
        >
          {submitting ? "جارٍ الفتح..." : "فتح العهدة"}
        </button>
      </div>
    </Card>
  );
}

export { CustodyOpenForm };
