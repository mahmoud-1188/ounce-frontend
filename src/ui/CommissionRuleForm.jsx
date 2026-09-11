import React, { useState } from "react";
import { COMMISSION_BASES } from "../core/erp.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

function CommissionRuleForm({ rule, currency, onCancel, onSave }) {
  const [basis, setBasis] = useState(rule.basis || "profit");
  const [ratePct, setRatePct] = useState(String((Number(rule.rate) || 0) * 100));
  const [target, setTarget] = useState(String(Number(rule.target) || 0));
  const [perInvoice, setPerInvoice] = useState(String(Number(rule.perInvoice) || 0));

  return (
    <Card style={{ padding: 14, marginBottom: 16 }}>
      <Field label="أساس احتساب العمولة">
        <div className="grid grid-cols-2 gap-2">
          {COMMISSION_BASES.map((b) => (
            <button
              key={b.id}
              onClick={() => setBasis(b.id)}
              className="py-2 rounded-xl text-xs font-bold"
              style={{ background: basis === b.id ? "var(--accentBg)" : "var(--panel)", color: basis === b.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </Field>
      <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
        {basis === "profit"
          ? "الأفضل عادة: يمنع البائع من تحقيق مبيعات عالية بخصومات تأكل الربح."
          : "تُحتسب على إجمالي المبيعات بغض النظر عن هامش الربح."}
      </p>
      <Field label="النسبة ٪">
        <NumericInput value={ratePct} onChange={setRatePct} placeholder="2" />
      </Field>
      <Field label={`حد أدنى للمبيعات قبل استحقاق النسبة (${currency}) — اتركه صفرًا لتعطيله`}>
        <NumericInput value={target} onChange={setTarget} placeholder="0" />
      </Field>
      <Field label={`عمولة ثابتة لكل فاتورة (${currency}) — اختياري`}>
        <NumericInput value={perInvoice} onChange={setPerInvoice} placeholder="0" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          onClick={() => onSave({ basis, rate: (Number(ratePct) || 0) / 100, target: Number(target) || 0, perInvoice: Number(perInvoice) || 0 })}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
        >
          حفظ
        </button>
      </div>
    </Card>
  );
}

export { CommissionRuleForm };
