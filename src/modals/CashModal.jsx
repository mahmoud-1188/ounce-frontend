import React, { useState } from "react";
import { MANUAL_ACCOUNT_TREE, PARTNER_REQUIRED } from "../core/constants.js";
import { METHODS, METHOD_LABELS } from "../core/money-rules.js";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";

function CashModal({ type, onClose, onConfirm, partners = [], onAddPartner }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("cash");
  /// ⚠ لا تصنيف افتراضي.
  ///
  /// كان أول خيارٍ في القائمة يُختار وحده، فيضغط الموظف «حفظ» ويمرّ
  /// المبلغ تحت تصنيفٍ لم يقرأه — ويظهر في حساب لا يخصّه.
  ///
  /// وكل حركة نقد لها سببٌ محاسبي: إيداعٌ بلا سبب رقمٌ في الدفتر لا
  /// يُفسَّر، ومن يراجع بعد شهر لا يعرف من أين جاء ولا إلى أين يُنسب.
  const [category, setCategory] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const options = type === "in" ? MANUAL_ACCOUNT_TREE.in : MANUAL_ACCOUNT_TREE.out;

  const needsPartner = PARTNER_REQUIRED.has(category);
  const noPartners = needsPartner && partners.length === 0;
  const valid =
    Number(amount) > 0 &&
    !!category &&
    (!needsPartner || (partnerId && partners.length > 0));
  return (
    <ModalShell title={type === "in" ? "تسجيل إيداع" : "تسجيل مصروف"} onClose={onClose}>
      <Field label="التصنيف المحاسبي">
        <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
          {/* ⚠ خيارٌ فارغ أولًا يُجبر على الاختيار.
              بدونه يُختار الأول وحده فيمرّ المبلغ تحت تصنيف لم يُقرأ. */}
          <option value="">اختر التصنيف…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {!category && (
          <p style={{ color: "var(--accent)" }} className="text-[10px] mt-1">
            ⚖ كل حركة نقد لها سببٌ محاسبي — إيداعٌ بلا سبب رقمٌ لا يُفسَّر.
          </p>
        )}
      </Field>
      {/* ── الشريك ── */}
      {needsPartner && (
        noPartners ? (
          <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--badLine)" }}>
            <p style={{ color: "var(--bad)" }} className="text-[11px] font-bold">
              ⚠ لا يوجد شركاء مسجّلون
            </p>
            <p style={{ color: "var(--text2)" }} className="text-[10px] mt-1">
              حقوق الملكية ملكُ أحدٍ بعينه. مساهمةٌ بلا مساهم تُنشئ رصيدًا
              لا يُعرف صاحبه، وعند التصفية يطالب به أكثر من واحد أو لا
              يطالب به أحد.
            </p>
            {onAddPartner && (
              <button
                onClick={() => { onClose(); onAddPartner(); }}
                className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold"
                style={{ background: "var(--accentBg)", color: "var(--accent)",
                         border: "1px solid var(--accentLine)" }}
              >
                أضف شريكًا أولًا
              </button>
            )}
          </Card>
        ) : (
          <Field label="الشريك">
            <select style={inputStyle} value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}>
              <option value="">اختر الشريك…</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.sharePct ? ` — ${p.sharePct}٪` : ""}
                </option>
              ))}
            </select>
          </Field>
        )
      )}

      <Field label="الطريقة">
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className="py-2 rounded-xl text-xs font-bold"
              style={{ background: method === m ? "var(--accentBg)" : "var(--panel)", color: method === m ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              {METHOD_LABELS[m]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="المبلغ">
        <input style={inputStyle} type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeNumeric(e.target.value))} placeholder="0.00" />
      </Field>
      <Field label="ملاحظة (اختياري)">
        <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "in" ? "مثال: إيداع رأس مال" : "مثال: فاتورة كهرباء"} />
      </Field>
      <button
        disabled={!valid}
        onClick={() => onConfirm(type, amount, note, method, category, partnerId || null)}
        className="w-full py-3 rounded-xl font-bold mt-2"
        style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
      >
        حفظ
      </button>
    </ModalShell>
  );
}

// ============================================================
// Expenses (المصروفات)
// ============================================================

export { CashModal };
