import React, { useState } from "react";
import { KARATS } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { InvoiceAttachField } from "./InvoiceAttachField.jsx";

function QuickLotForm({ onCancel, onCreate, suppliers }) {
  const [supplierId, setSupplierId] = useState("");
  const [karat, setKarat] = useState(21);
  const [weight, setWeight] = useState("");
  const [costPerGram, setCostPerGram] = useState("");
  const [workmanshipTotal, setWorkmanshipTotal] = useState("");
  const [invoiceFile, setInvoiceFile] = useState(null);

  // المورد يُسجَّل مسبقًا من صفحة الموردين — هنا اختيار فقط.
  const hasSupplier = !!supplierId;
  const valid = hasSupplier && Number(weight) > 0 && Number(costPerGram) > 0 && String(workmanshipTotal).trim() !== "";

  return (
    <Card style={{ padding: 12, marginBottom: 16 }}>
      <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
        شراء دفعة جديدة من مورد
      </p>
      <Field label="المورد">
        <select style={inputStyle} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">— مورد جديد —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      {!supplierId && (
        <Field label="اسم المورد الجديد">
          <span style={{ color: "var(--bad)" }} className="text-[11px]">أضف المورد من صفحة الموردين أولًا</span>
        </Field>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Field label="العيار">
          <select style={inputStyle} value={karat} onChange={(e) => setKarat(Number(e.target.value))}>
            {KARATS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الوزن (جم)">
          <input style={inputStyle} type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(sanitizeNumeric(e.target.value))} placeholder="1000" />
        </Field>
        <Field label="سعر/جم">
          <input style={inputStyle} type="text" inputMode="decimal" value={costPerGram} onChange={(e) => setCostPerGram(sanitizeNumeric(e.target.value))} placeholder="0.00" />
        </Field>
      </div>
      <Field label="الأجور الإجمالية للدفعة (اختياري)">
        <input style={inputStyle} type="text" inputMode="decimal" value={workmanshipTotal} onChange={(e) => setWorkmanshipTotal(sanitizeNumeric(e.target.value))} placeholder="0.00" />
      </Field>
      <InvoiceAttachField value={invoiceFile} onChange={setInvoiceFile} label="فاتورة الشراء" optional />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={!valid}
          onClick={() =>
            onCreate({
              supplierId: supplierId || null,
              newSupplierPhone: "",
              karat,
              weight: Number(weight),
              costPerGram: Number(costPerGram),
              workmanshipTotal: Number(workmanshipTotal) || 0,
              workmanshipMode: "per_gram",
              invoiceFile,
            })
          }
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
        >
          إنشاء الدفعة
        </button>
      </div>
    </Card>
  );
}


/// رسم سعر الذهب — متحرك وتفاعلي.
///
/// اللون يتبع الاتجاه (أخضر صاعد · أحمر هابط)، والمنحنى يُرسم عند كل
/// تحديث، وتجري عليه ومضة ضوء، وتنبض نقطة آخر سعر. اللمس أو المؤشر
/// يكشف قيمة أي نقطة.
///
/// بُني بـSVG خالص لا بمكتبة رسم: التحكم في التوهج والتدرّج والحركة
/// يحتاج وصولًا مباشرًا للعناصر، والمكتبة تُغلّفها.

export { QuickLotForm };
