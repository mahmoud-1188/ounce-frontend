import React, { useState } from "react";
import { fmtMoney, fmtW, pricePerGram } from "../core/money.js";
import { FUNDING_SOURCES } from "../core/workflow.js";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";

function AddPartnerTxForm({ onCancel, onSubmit, currency, price24 }) {
  const [type, setType] = useState("contribution"); // 'contribution' | 'withdrawal' | 'profit_share'
  const [unit, setUnit] = useState("sar"); // 'sar' | 'gram'
  const [amount, setAmount] = useState("");
  const [fundingSource, setFundingSource] = useState("safe_cash");
  const [goldKind, setGoldKind] = useState("raw");
  const [note, setNote] = useState("");
  const valid = Number(amount) > 0;
  const typeOptions = [
    { id: "contribution", label: "مساهمة" },
    { id: "withdrawal", label: "سحب" },
    { id: "profit_share", label: "توزيع أرباح" },
  ];
  const perGram = pricePerGram(24, price24);
  const raw = Number(amount) || 0;
  const equivalent = unit === "gram" ? raw * perGram : perGram > 0 ? raw / perGram : 0;

  return (
    <Card style={{ padding: 14, marginBottom: 16 }}>
      <Field label="نوع الحركة">
        <div className="grid grid-cols-3 gap-2">
          {typeOptions.map((o) => (
            <button
              key={o.id}
              onClick={() => setType(o.id)}
              className="py-2 rounded-xl text-xs font-bold"
              style={{ background: type === o.id ? "var(--accentBg)" : "var(--panel)", color: type === o.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="طريقة السداد">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setUnit("sar")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: unit === "sar" ? "var(--accentBg)" : "var(--panel)", color: unit === "sar" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            بالريال
          </button>
          <button
            onClick={() => setUnit("gram")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: unit === "gram" ? "var(--accentBg)" : "var(--panel)", color: unit === "gram" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            بالذهب (جرام)
          </button>
        </div>
      </Field>
      <Field label={unit === "gram" ? "الوزن (جرام عيار 24)" : `المبلغ (${currency})`}>
        <input style={inputStyle} type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeNumeric(e.target.value))} placeholder="0.00" />
      </Field>
      {raw > 0 && (
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
          يعادل {unit === "gram" ? `${currency}${fmtMoney(equivalent)}` : `${fmtW(equivalent)} جم`} بسعر اليوم
        </p>
      )}
      {unit === "gram" ? (
        <>
          <Field label="نوع الذهب">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setGoldKind("raw")}
                className="py-2 rounded-xl text-xs font-bold"
                style={{ background: goldKind === "raw" ? "var(--accentBg)" : "var(--panel)", color: goldKind === "raw" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
              >
                كسر / خام
              </button>
              <button
                onClick={() => setGoldKind("crafted")}
                className="py-2 rounded-xl text-xs font-bold"
                style={{ background: goldKind === "crafted" ? "var(--accentBg)" : "var(--panel)", color: goldKind === "crafted" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
              >
                مشغول
              </button>
            </div>
          </Field>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
            {type === "contribution" ? "سيُضاف الذهب إلى رصيد ذهب الخزنة." : "سيُخصم الذهب من رصيد ذهب الخزنة."}
          </p>
        </>
      ) : (
        <Field label={type === "contribution" ? "تودَع في" : "الدفع من"}>
          <select style={inputStyle} value={fundingSource} onChange={(e) => setFundingSource(e.target.value)}>
            {FUNDING_SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="ملاحظات (اختياري)">
        <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={!valid}
          onClick={() => onSubmit(type, { unit, amount, note, fundingSource, goldKind })}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
        >
          حفظ
        </button>
      </div>
    </Card>
  );
}

export { AddPartnerTxForm };
