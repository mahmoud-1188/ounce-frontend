import React, { useState } from "react";
import { fmtMoney } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

function CustodyCloseForm({ expectedCash, expectedNetwork, currency, onCancel, onSubmit }) {
  const [cash, setCash] = useState("");
  const [network, setNetwork] = useState("");
  const [note, setNote] = useState("");
  // ⚠ onSubmit صار نداء شبكة غير متزامن — نفس سبب CustodyOpenForm.
  const [submitting, setSubmitting] = useState(false);
  const touched = cash !== "" || network !== "";
  const varCash = (Number(cash) || 0) - expectedCash;
  const varNet = (Number(network) || 0) - expectedNetwork;
  const total = varCash + varNet;
  const matched = Math.abs(total) < 0.0001;
  return (
    <Card style={{ padding: 12, marginTop: 10, background: "var(--bg)" }}>
      <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
        اعدّ ما بالصندوق اليومي فعليًا وأدخله. الفرق يُسجَّل كزيادة أو عجز باسم صاحب العهدة.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label={`النقدي المعدود (${currency})`}>
          <NumericInput value={cash} onChange={setCash} />
        </Field>
        <Field label={`الشبكة المعدودة (${currency})`}>
          <NumericInput value={network} onChange={setNetwork} />
        </Field>
      </div>
      <div className="flex flex-col gap-1 mb-2">
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text2)" }} className="text-[11px]">
            المتوقع
          </span>
          <span style={{ color: "var(--text)" }} className="text-[11px] font-bold">
            {currency}
            {fmtMoney(expectedCash + expectedNetwork)}
          </span>
        </div>
        {touched && (
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text2)" }} className="text-[11px]">
              الفرق
            </span>
            <span style={{ color: matched ? "var(--goodSolid)" : total > 0 ? "var(--accent)" : "var(--bad)" }} className="text-sm font-bold">
              {matched ? "مطابق تمامًا" : `${total > 0 ? "زيادة" : "عجز"} ${currency}${fmtMoney(Math.abs(total))}`}
            </span>
          </div>
        )}
      </div>
      <Field label="ملاحظة (اختياري)">
        <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={!touched || submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onSubmit(cash, network, note);
            } finally {
              setSubmitting(false);
            }
          }}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: touched ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: touched ? "var(--panel)" : "var(--text3)" }}
        >
          {submitting ? "جارٍ التنفيذ..." : "تأكيد الجرد والإقفال"}
        </button>
      </div>
    </Card>
  );
}

export { CustodyCloseForm };
